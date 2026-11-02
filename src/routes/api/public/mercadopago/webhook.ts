import { createFileRoute } from "@tanstack/react-router";
import { verifyMercadoPagoSignature } from "@/lib/billing/signature";
import { mpRequest, mpToken } from "@/lib/billing/mercadopago";
import {
  decideAuthorizedPayment,
  decidePayment,
  decidePreapproval,
  MpAuthorizedPaymentSchema,
  MpPaymentSchema,
  MpPreapprovalSchema,
  type Decision,
} from "@/lib/billing/webhook";
import { shouldRevert } from "@/lib/calc/coupon";
import { parseReference, toCents } from "@/lib/billing/catalog";
import { reportIncident } from "@/lib/monitoring/incidents.server";

// Notificação do Mercado Pago. Só confia na assinatura e nos dados lidos direto da API.
// Eventos: payment (cobranças), subscription_preapproval (status da assinatura) e
// subscription_authorized_payment (cada cobrança recorrente). A decisão fica em src/lib/billing/webhook.ts.
// Cada notificação (x-request-id) é processada uma vez só: reenviar a mesma requisição assinada não faz nada.
// Se o processamento falhar, o recibo é desfeito para o Mercado Pago poder reenviar.
const ID = /^[\w-]{1,64}$/;

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

export const Route = createFileRoute("/api/public/mercadopago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["MERCADO_PAGO_WEBHOOK_SECRET"];
        const token = mpToken();
        if (!secret || !token) return new Response("not configured", { status: 503 });

        const url = new URL(request.url);
        const body = (await request.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
        const dataId = url.searchParams.get("data.id") ?? (body.data?.id != null ? String(body.data.id) : null);
        const requestId = request.headers.get("x-request-id");
        if (!requestId || requestId.length > 200) return new Response("missing request id", { status: 400 });
        const ok = await verifyMercadoPagoSignature({ secret, header: request.headers.get("x-signature"), requestId, dataId });
        if (!ok) return new Response("invalid signature", { status: 401 });
        if (!dataId || !ID.test(dataId)) return new Response("ignored");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const receipt = await supabaseAdmin.from("webhook_receipts").insert({ provider: "mercadopago", request_id: requestId });
        if (receipt.error) {
          if (receipt.error.code === "23505") return new Response("duplicate");
          console.error("webhook receipt failed", receipt.error.message);
          return new Response("db error", { status: 500 });
        }
        const response = await handle(supabaseAdmin, token, url.searchParams.get("type") ?? body.type, dataId);
        if (response.status >= 400) {
          await supabaseAdmin.from("webhook_receipts").delete().eq("provider", "mercadopago").eq("request_id", requestId);
        }
        return response;
      },
    },
  },
});

/**
 * Todo pagamento lido do Mercado Pago (aprovado, pendente, recusado, estornado) vai para payment_events, para o
 * painel de faturamento e a conciliação. Só registro: a decisão de crédito continua em decidePayment.
 */
async function recordPaymentEvent(supabaseAdmin: Admin, p: { id: number; status: string; amount: number; reference: string | null }) {
  const ref = parseReference(p.reference);
  const { error } = await supabaseAdmin.from("payment_events").upsert(
    {
      id: `mp_${p.id}`,
      user_id: ref?.userId ?? null,
      status: p.status.slice(0, 40),
      amount_cents: toCents(p.amount),
      plan: ref?.plan ?? null,
      period: ref?.period ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) console.error("payment_events upsert failed", error.message);
}

/** Cupom com prazo: depois da última cobrança com desconto, a assinatura no Mercado Pago volta ao preço cheio. */
async function revertCouponIfDone(supabaseAdmin: Admin, token: string, userId: string) {
  const { data: sub, error } = await supabaseAdmin
    .from("subscriptions")
    .select("preapproval_id, amount_cents, full_cents, coupon_cycles, cycles_used")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !sub || sub.amount_cents === null || sub.full_cents === null) return;
  if (!shouldRevert({ amountCents: sub.amount_cents, fullCents: sub.full_cents, cycles: sub.coupon_cycles, cyclesUsed: sub.cycles_used })) return;

  const res = await mpRequest(token, `/preapproval/${encodeURIComponent(sub.preapproval_id)}`, MpPreapprovalSchema, {
    method: "PUT",
    body: { auto_recurring: { transaction_amount: sub.full_cents / 100, currency_id: "BRL" } },
  });
  if (!res) {
    console.error("coupon revert failed", sub.preapproval_id);
    await reportIncident("pagamento", "Não voltou a assinatura ao preço cheio depois do cupom (tenta de novo na próxima cobrança)", { level: "aviso" });
    return;
  }
  const saved = await supabaseAdmin.from("subscriptions").update({ amount_cents: sub.full_cents }).eq("user_id", userId);
  if (saved.error) console.error("coupon revert save failed", saved.error.message);
  await supabaseAdmin.rpc("audit", {
    p_action: "coupon_ended",
    p_target: userId,
    p_details: { preapproval: sub.preapproval_id, full_cents: sub.full_cents },
  });
}

async function handle(supabaseAdmin: Admin, token: string, type: string | undefined, dataId: string): Promise<Response> {
  // Falha ao ler do Mercado Pago responde 502: ele reenvia a notificação, e nenhuma cobrança se perde.
  const upstreamError = () => new Response("upstream error", { status: 502 });
  let decision: Decision;
  if (type === "payment") {
    const p = await mpRequest(token, `/v1/payments/${dataId}`, MpPaymentSchema);
    if (!p) return upstreamError();
    decision = decidePayment(p);
    await recordPaymentEvent(supabaseAdmin, { id: p.id, status: p.status, amount: p.transaction_amount, reference: p.external_reference ?? null });
  } else if (type === "subscription_authorized_payment") {
    const ap = await mpRequest(token, `/authorized_payments/${dataId}`, MpAuthorizedPaymentSchema);
    if (!ap) return upstreamError();
    let fallbackRef: string | null = null;
    if (!ap.external_reference) {
      const pre = await mpRequest(token, `/preapproval/${encodeURIComponent(ap.preapproval_id)}`, MpPreapprovalSchema);
      if (!pre) return upstreamError();
      fallbackRef = pre.external_reference ?? null;
    }
    decision = decideAuthorizedPayment(ap, fallbackRef);
    if (ap.payment)
      await recordPaymentEvent(supabaseAdmin, { id: ap.payment.id, status: ap.payment.status, amount: ap.transaction_amount, reference: ap.external_reference || fallbackRef });
  } else if (type === "subscription_preapproval") {
    const pre = await mpRequest(token, `/preapproval/${encodeURIComponent(dataId)}`, MpPreapprovalSchema);
    if (!pre) return upstreamError();
    decision = decidePreapproval(pre);
  } else {
    return new Response("ignored");
  }

  if (decision.action === "ignore") {
    if (decision.reason === "referência ou valor não confere") {
      // Pagamento aprovado que não bate com o catálogo: possível manipulação, vai para a auditoria.
      console.error("Mercado Pago event rejected:", type, dataId);
      await supabaseAdmin.rpc("audit", {
        p_action: "payment_rejected",
        p_target: `mp:${dataId}`,
        p_details: { type: type ?? null, reason: decision.reason },
        p_severity: "high",
      });
    }
    return new Response(decision.reason);
  }

  if (decision.action === "credit") {
    const c = decision.credit;
    const { error } = await supabaseAdmin.rpc("credit_payment", {
      p_id: c.id,
      p_user: c.userId,
      p_plan: c.plan,
      p_period: c.period,
      p_amount_cents: c.cents,
    });
    if (error) {
      console.error("credit_payment failed", error.message);
      await reportIncident("pagamento", `credit_payment falhou: ${error.message}`, { level: "critico" });
      return new Response("db error", { status: 500 });
    }
    // O pagamento já está creditado: falha aqui só fica no log e tenta de novo na próxima notificação.
    await revertCouponIfDone(supabaseAdmin, token, c.userId);
    return new Response("ok");
  }

  // Só grava se a informação for mais nova que a já gravada (notificações chegam fora de ordem).
  const { data: applied, error } = await supabaseAdmin.rpc("apply_subscription_status", {
    p_user: decision.userId,
    p_preapproval: decision.preapprovalId,
    p_plan: decision.plan,
    p_period: decision.period,
    p_status: decision.status,
    p_event_at: decision.eventAt ?? new Date().toISOString(),
  });
  if (error) {
    console.error("subscription status failed", error.message);
    await reportIncident("pagamento", `status da assinatura não gravado: ${error.message}`);
    return new Response("db error", { status: 500 });
  }
  if (!applied) return new Response("stale");
  // Funil: só de quem aceitou o analytics (a escolha do banner fica no perfil). Falha aqui não muda a resposta.
  if (decision.status === "authorized") {
    const { data: profile } = await supabaseAdmin.from("profiles").select("analytics_consent").eq("id", decision.userId).maybeSingle();
    if (profile?.analytics_consent) {
      const tracked = await supabaseAdmin
        .from("analytics_events")
        .insert({ user_id: decision.userId, name: "subscription_authorized", props: { period: decision.period } });
      if (tracked.error) console.error("analytics insert failed", tracked.error.message);
    }
  }
  return new Response("ok");
}
