// Abre uma assinatura no Mercado Pago para uma conta e devolve o link de autorização. Usado pela
// própria pessoa (createSubscription) e pelo admin, que gera um link novo para mandar a ela.
// Só roda no servidor (token do Mercado Pago e cliente com service role).
import { buildReference, PLAN_NAMES, type BillingPeriod } from "./catalog";
import { currentPriceCents } from "./prices.server";
import { mpRequest, mpToken } from "./mercadopago";
import { MpPreapprovalSchema, type SubscriptionStatus } from "./webhook";
import type { ValidCoupon } from "./coupons.server";
import { APP_NAME } from "@/lib/seo";

export const NOT_CONFIGURED = "O pagamento ainda não está configurado." as const;
export const TRY_AGAIN = "Não foi possível falar com o Mercado Pago agora. Tente de novo em instantes." as const;

export type OpenResult = { error: string; url: null } | { error: null; url: string };

export async function openSubscription(input: {
  userId: string;
  email: string | null;
  plan: "inteligencia";
  period: BillingPeriod;
  origin: string;
  /** Assinatura já registrada para a conta (lida antes por quem chama). */
  existing: { preapproval_id: string; status: SubscriptionStatus | string } | null;
  /** Cupom já conferido (loadCoupon): a assinatura nasce com o valor com desconto. */
  coupon?: ValidCoupon | null;
}): Promise<OpenResult> {
  const token = mpToken();
  if (!token) return { error: NOT_CONFIGURED, url: null };
  const coupon = input.coupon ?? null;
  // Preço de hoje (o cupom já foi calculado sobre ele); fica gravado na referência e vale para sempre nesta assinatura.
  let full: number | null;
  try {
    full = coupon ? coupon.fullCents : await currentPriceCents(input.plan, input.period);
  } catch (e) {
    console.error("plan price read failed", e instanceof Error ? e.message : e);
    return { error: TRY_AGAIN, url: null };
  }
  if (full === null || !input.email) return { error: "Não foi possível abrir a assinatura para esta conta.", url: null };
  const cents = coupon ? coupon.amountCents : full;

  const { existing } = input;
  if (existing?.status === "authorized" || existing?.status === "paused")
    return { error: "Esta conta já tem uma assinatura. Veja os detalhes em Assinatura.", url: null };
  // Uma tentativa anterior ficou sem autorizar: cancela antes, para as duas nunca serem cobradas.
  if (existing?.status === "pending") {
    const cancelled = await mpRequest(token, `/preapproval/${encodeURIComponent(existing.preapproval_id)}`, MpPreapprovalSchema, {
      method: "PUT",
      body: { status: "cancelled" },
    });
    if (!cancelled) return { error: TRY_AGAIN, url: null };
  }

  const pre = await mpRequest(token, "/preapproval", MpPreapprovalSchema, {
    method: "POST",
    body: {
      reason: `${APP_NAME} ${PLAN_NAMES[input.plan]} (${input.period})`,
      external_reference: buildReference(input.userId, input.plan, input.period, cents, full),
      payer_email: input.email,
      auto_recurring: {
        frequency: input.period === "anual" ? 12 : 1,
        frequency_type: "months",
        transaction_amount: cents / 100,
        currency_id: "BRL",
      },
      back_url: `${input.origin}/pagamento`,
      status: "pending",
    },
  });
  if (!pre?.init_point) return { error: TRY_AGAIN, url: null };

  // Registra já como pendente: um segundo clique encontra esta e a cancela, em vez de abrir outra em paralelo.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const saved = await supabaseAdmin.from("subscriptions").upsert({
    user_id: input.userId,
    preapproval_id: pre.id,
    plan: input.plan,
    period: input.period,
    status: "pending",
    updated_at: new Date().toISOString(),
    coupon_id: coupon?.id ?? null,
    amount_cents: cents,
    full_cents: full,
    coupon_cycles: coupon?.cycles ?? null,
    cycles_used: 0,
  });
  if (saved.error) {
    console.error("subscription pending upsert failed", saved.error.message);
    return { error: TRY_AGAIN, url: null };
  }
  return { error: null, url: pre.init_point };
}
