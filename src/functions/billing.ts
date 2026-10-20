// Checkout do plano pago no Mercado Pago (Checkout Pro: PIX e cartão).
// Função de servidor do TanStack; exige login (requireSupabaseAuth) e o token MERCADO_PAGO_ACCESS_TOKEN no ambiente.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { encodeRef, priceCents, type PaidPlan, type Period } from "@/lib/billing";

const PLAN_NAME: Record<PaidPlan, string> = { inteligencia: "Previdência Intelligence · Inteligência", pro: "Previdência Intelligence · Pro" };

function validate(d: unknown): { plan: PaidPlan; period: Period } {
  const x = (d ?? {}) as Record<string, unknown>;
  const plan = x["plan"] === "pro" ? "pro" : x["plan"] === "inteligencia" ? "inteligencia" : null;
  const period = x["period"] === "anual" ? "anual" : x["period"] === "mensal" ? "mensal" : null;
  if (!plan || !period) throw new Error("Plano inválido.");
  return { plan, period };
}

function site(): string {
  const fromEnv = process.env["PUBLIC_SITE_URL"];
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const url = new URL(getRequest().url);
  return `${url.protocol}//${url.host}`;
}

/** Cria a cobrança e devolve o endereço do checkout do Mercado Pago. */
export const startCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(validate)
  .handler(async ({ data, context }) => {
    const token = process.env["MERCADO_PAGO_ACCESS_TOKEN"];
    if (!token) throw new Error("Pagamentos ainda não estão configurados.");
    const { data: user } = await context.supabase.auth.getUser();
    const base = site();
    const amount = priceCents(data.plan, data.period) / 100;
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            id: `${data.plan}-${data.period}`,
            title: `${PLAN_NAME[data.plan]} (${data.period === "anual" ? "12 meses" : "1 mês"})`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: amount,
          },
        ],
        payer: user.user?.email ? { email: user.user.email } : undefined,
        external_reference: encodeRef(context.userId, data.plan, data.period),
        back_urls: {
          success: `${base}/assinatura?status=aprovado`,
          pending: `${base}/assinatura?status=pendente`,
          failure: `${base}/assinatura?status=recusado`,
        },
        auto_return: "approved",
        notification_url: `${base}/api/pagamentos/webhook`,
        statement_descriptor: "PREVIDENCIA INT",
      }),
    });
    if (!res.ok) throw new Error("Não foi possível abrir o pagamento agora.");
    const pref = (await res.json()) as { init_point?: string };
    if (!pref.init_point) throw new Error("Não foi possível abrir o pagamento agora.");
    return { url: pref.init_point };
  });
