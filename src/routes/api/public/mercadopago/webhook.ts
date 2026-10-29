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

// Notificação do Mercado Pago. Só confia na assinatura e nos dados lidos direto da API.
// Eventos: payment (cobranças), subscription_preapproval (status da assinatura) e
// subscription_authorized_payment (cada cobrança recorrente). A decisão fica em src/lib/billing/webhook.ts.
const ID = /^[\w-]{1,64}$/;

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
        const ok = await verifyMercadoPagoSignature({
          secret,
          header: request.headers.get("x-signature"),
          requestId: request.headers.get("x-request-id"),
          dataId,
        });
        if (!ok) return new Response("invalid signature", { status: 401 });
        if (!dataId || !ID.test(dataId)) return new Response("ignored");

        const type = url.searchParams.get("type") ?? body.type;
        // Falha ao ler do Mercado Pago responde 502: ele reenvia a notificação, e nenhuma cobrança se perde.
        const upstreamError = () => new Response("upstream error", { status: 502 });
        let decision: Decision;
        if (type === "payment") {
          const p = await mpRequest(token, `/v1/payments/${dataId}`, MpPaymentSchema);
          if (!p) return upstreamError();
          decision = decidePayment(p);
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
        } else if (type === "subscription_preapproval") {
          const pre = await mpRequest(token, `/preapproval/${encodeURIComponent(dataId)}`, MpPreapprovalSchema);
          if (!pre) return upstreamError();
          decision = decidePreapproval(pre);
        } else {
          return new Response("ignored");
        }

        if (decision.action === "ignore") {
          if (decision.reason === "referência ou valor não confere") console.error("Mercado Pago event rejected:", type, dataId);
          return new Response(decision.reason);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
            return new Response("db error", { status: 500 });
          }
          return new Response("ok");
        }

        const { error } = await supabaseAdmin.from("subscriptions").upsert({
          user_id: decision.userId,
          preapproval_id: decision.preapprovalId,
          plan: decision.plan,
          period: decision.period,
          status: decision.status,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.error("subscription upsert failed", error.message);
          return new Response("db error", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
