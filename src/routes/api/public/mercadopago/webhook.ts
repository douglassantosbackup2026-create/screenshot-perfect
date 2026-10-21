import { createFileRoute } from "@tanstack/react-router";
import { parseReference, priceCents, toCents } from "@/lib/billing/catalog";
import { verifyMercadoPagoSignature } from "@/lib/billing/signature";

// Notificação do Mercado Pago. Só confia na assinatura e nos dados lidos direto da API.
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

        const type = url.searchParams.get("type") ?? body.type;
        if (type !== "payment" || !dataId || !/^\d{1,30}$/.test(dataId)) return new Response("ignored");

        const res = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          console.error(`Mercado Pago payment fetch failed [${res.status}]: ${await res.text()}`);
          return new Response("upstream error", { status: 502 }); // o Mercado Pago tenta de novo
        }
        const p = (await res.json()) as { id: number; status: string; transaction_amount: number; currency_id: string; external_reference?: string };
        if (p.status !== "approved") return new Response("not approved");

        const ref = parseReference(p.external_reference);
        const cents = toCents(p.transaction_amount);
        if (!ref || p.currency_id !== "BRL" || cents !== priceCents(ref.plan, ref.period)) {
          console.error("Mercado Pago payment rejected: reference or amount mismatch", p.id);
          return new Response("mismatch");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.rpc("credit_payment", {
          p_id: `mp_${p.id}`,
          p_user: ref.userId,
          p_plan: ref.plan,
          p_period: ref.period,
          p_amount_cents: cents,
        });
        if (error) {
          console.error("credit_payment failed", error.message);
          return new Response("db error", { status: 500 });
        }
        return new Response("ok");
      },
    },
  },
});
