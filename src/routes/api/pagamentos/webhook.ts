import { createFileRoute } from "@tanstack/react-router";
import { decodeRef, priceCents } from "@/lib/billing";

/**
 * Aviso de pagamento do Mercado Pago. Nunca confia no corpo do aviso: busca o pagamento na API do Mercado Pago
 * e só credita se estiver aprovado, com a nossa referência e o valor certo. credit_payment ignora repetições.
 * Com MERCADO_PAGO_WEBHOOK_SECRET, confere também a assinatura (x-signature).
 */
export const Route = createFileRoute("/api/pagamentos/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
    },
  },
});

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Assinatura do Mercado Pago: v1 = HMAC(secret, "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"). */
async function signatureOk(request: Request, dataId: string, secret: string) {
  const sig = request.headers.get("x-signature") ?? "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!parts["ts"] || !parts["v1"]) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${request.headers.get("x-request-id") ?? ""};ts:${parts["ts"]};`;
  return (await hmacHex(secret, manifest)) === parts["v1"];
}

async function handle(request: Request) {
  const token = process.env["MERCADO_PAGO_ACCESS_TOKEN"];
  if (!token) return new Response("pagamentos nao configurados", { status: 503 });
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } };
  const type = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  // Outros avisos (pedidos, estornos) são aceitos e ignorados, para o Mercado Pago não reenviar.
  if (type !== "payment" || !dataId) return new Response("ok");

  const secret = process.env["MERCADO_PAGO_WEBHOOK_SECRET"];
  if (secret && !(await signatureOk(request, dataId, secret))) return new Response("assinatura invalida", { status: 401 });

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return new Response("pagamento nao encontrado", { status: 404 });
  const payment = (await res.json()) as { id: number | string; status: string; external_reference?: string; transaction_amount?: number; currency_id?: string };
  if (payment.status !== "approved") return new Response("ok");
  const ref = decodeRef(payment.external_reference);
  if (!ref) return new Response("referencia desconhecida", { status: 400 });
  const expected = priceCents(ref.plan, ref.period);
  const paid = Math.round((payment.transaction_amount ?? 0) * 100);
  if (payment.currency_id !== "BRL" || paid < expected) return new Response("valor nao confere", { status: 400 });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as { rpc: (fn: string, p: unknown) => PromiseLike<{ data: unknown; error: { message: string } | null }> };
  const { data, error } = await db.rpc("credit_payment", {
    p_id: String(payment.id),
    p_user: ref.userId,
    p_plan: ref.plan,
    p_period: ref.period,
    p_amount_cents: paid,
  });
  if (error) return new Response("erro ao creditar", { status: 500 });
  return Response.json(data);
}
