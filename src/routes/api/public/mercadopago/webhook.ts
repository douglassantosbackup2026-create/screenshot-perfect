import { createFileRoute } from "@tanstack/react-router";
import { verifyMercadoPagoSignature } from "@/lib/billing/signature";
import {
  decideAuthorizedPayment,
  decidePayment,
  decidePreapproval,
  type Decision,
  type MpAuthorizedPayment,
  type MpPayment,
  type MpPreapproval,
} from "@/lib/billing/webhook";

// Notificação do Mercado Pago. Só confia na assinatura e nos dados lidos direto da API.
// Eventos: payment (cobranças), subscription_preapproval (status da assinatura) e
// subscription_authorized_payment (cada cobrança recorrente). A decisão fica em src/lib/billing/webhook.ts.
const MP = "https://api.mercadopago.com";
const ID = /^[\w-]{1,64}$/;

export const Route = createFileRoute("/api/public/mercadopago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["MERCADO_PAGO_WEBHOOK_SECRET"];
        const token = process.env["MERCADO_PAGO_ACCESS_TOKEN"];
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

        const get = async <T,>(path: string): Promise<T | null> => {
          const res = await fetch(`${MP}${path}`, { headers: { Authorization: `Bearer ${token}` } });
          if (!res.ok) {
            console.error(`Mercado Pago fetch ${path} failed [${res.status}]: ${await res.text()}`);
            return null;
          }
          return (await res.json()) as T;
        };

        const type = url.searchParams.get("type") ?? body.type;
        let decision: Decision;
        if (type === "payment") {
          const p = await get<MpPayment>(`/v1/payments/${dataId}`);
          if (!p) return new Response("upstream error", { status: 502 }); // o Mercado Pago tenta de novo
          decision = decidePayment(p);
        } else if (type === "subscription_authorized_payment") {
          const ap = await get<MpAuthorizedPayment>(`/authorized_payments/${dataId}`);
          if (!ap) return new Response("upstream error", { status: 502 });
          const pre = ap.external_reference ? null : await get<MpPreapproval>(`/preapproval/${encodeURIComponent(ap.preapproval_id)}`);
          decision = decideAuthorizedPayment(ap, pre?.external_reference);
        } else if (type === "subscription_preapproval") {
          const pre = await get<MpPreapproval>(`/preapproval/${encodeURIComponent(dataId)}`);
          if (!pre) return new Response("upstream error", { status: 502 });
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
