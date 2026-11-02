// Assinatura recorrente no Mercado Pago (preapproval): criar e cancelar.
// O acesso só muda pelo webhook, que confere cada cobrança na API do Mercado Pago.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { allow, TOO_MANY } from "@/lib/security/rate-limit.server";
import { mpRequest, mpToken } from "./mercadopago";
import { MpPreapprovalSchema } from "./webhook";
import { NOT_CONFIGURED, openSubscription, TRY_AGAIN } from "./open-subscription";
import { loadCoupon, normalizeCoupon, type ValidCoupon } from "./coupons.server";
import { DEFAULT_PRICES_CENTS, type BillingPeriod } from "./catalog";

/** Abre a assinatura no Mercado Pago e devolve o link para a pessoa autorizar o cartão. */
export const createSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Só o Inteligência está à venda; o Pro ainda é lista de espera.
  .validator((d) =>
    z.object({ plan: z.literal("inteligencia"), period: z.enum(["mensal", "anual"]), coupon: z.string().max(40).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!(await allow([{ key: `subscribe:user:${context.userId}`, limit: 10, windowSeconds: 3600 }]))) return { error: TOO_MANY, url: null };
    // Sem saber se já existe assinatura, não cria outra: o risco é cobrar duas vezes.
    const { data: existing, error } = await context.supabase
      .from("subscriptions")
      .select("preapproval_id, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) return { error: TRY_AGAIN, url: null };
    const email = typeof context.claims.email === "string" ? context.claims.email : null;

    let coupon: ValidCoupon | null = null;
    if (data.coupon?.trim()) {
      try {
        const r = await loadCoupon(context.userId, data.coupon, data.period);
        if (!r.coupon) return { error: r.error, url: null };
        coupon = r.coupon;
      } catch (e) {
        console.error("coupon check failed", e instanceof Error ? e.message : e);
        return { error: "Não foi possível conferir o cupom agora. Tente de novo.", url: null };
      }
    }

    const opened = await openSubscription({
      userId: context.userId,
      email,
      plan: data.plan,
      period: data.period,
      origin: new URL(getRequest().url).origin,
      existing,
      coupon,
    });
    if (opened.url && coupon?.affiliateId) await linkToAffiliate(context.userId, email, coupon);
    return opened;
  });

/** Cupom de afiliado: quem usa vira indicado dele, se ainda não for de ninguém (nunca de si mesmo). */
async function linkToAffiliate(userId: string, email: string | null, coupon: ValidCoupon) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: aff } = await supabaseAdmin.from("affiliates").select("id, email, status").eq("id", coupon.affiliateId!).maybeSingle();
  if (!aff || aff.status !== "aprovado" || aff.email === email?.toLowerCase()) return;
  const { error } = await supabaseAdmin
    .from("referrals")
    .upsert({ user_id: userId, affiliate_id: aff.id, code: coupon.code, source: "cupom" }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) console.error("coupon referral failed", error.message);
}

/** Preço com o cupom, para mostrar antes de abrir o Mercado Pago. Quem decide de verdade é createSubscription. */
export const previewCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ code: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await allow([{ key: `coupon:user:${context.userId}`, limit: 20, windowSeconds: 3600 }]))) return { error: TOO_MANY, prices: null };
    try {
      const prices: Partial<Record<BillingPeriod, { fullCents: number; amountCents: number }>> = {};
      let description = "";
      let firstError: string | null = null;
      for (const period of Object.keys(DEFAULT_PRICES_CENTS.inteligencia) as BillingPeriod[]) {
        const r = await loadCoupon(context.userId, data.code, period);
        if (!r.coupon) firstError ??= r.error;
        else {
          prices[period] = { fullCents: r.coupon.fullCents, amountCents: r.coupon.amountCents };
          description = r.coupon.description;
        }
      }
      if (!Object.keys(prices).length) return { error: firstError ?? "Cupom inválido ou vencido.", prices: null };
      return { error: null, prices, description, code: normalizeCoupon(data.code)! };
    } catch (e) {
      console.error("coupon preview failed", e instanceof Error ? e.message : e);
      return { error: "Não foi possível conferir o cupom agora. Tente de novo.", prices: null };
    }
  });

/** Cancela as próximas cobranças. O acesso continua até o fim do período já pago. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await allow([{ key: `cancel:user:${context.userId}`, limit: 10, windowSeconds: 3600 }]))) return { error: TOO_MANY };
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("preapproval_id, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    // Erro na leitura não é "sem assinatura": quem chama (excluir a conta) precisa parar aqui.
    if (error) return { error: "Não foi possível conferir sua assinatura agora. Tente de novo em instantes." };
    // Sem assinatura (ou já cancelada) não há o que cancelar, nem com o Mercado Pago desligado.
    if (!sub || sub.status === "cancelled") return { error: null };
    const token = mpToken();
    if (!token) return { error: NOT_CONFIGURED };

    const res = await mpRequest(token, `/preapproval/${encodeURIComponent(sub.preapproval_id)}`, MpPreapprovalSchema, {
      method: "PUT",
      body: { status: "cancelled" },
    });
    if (!res) return { error: "Não foi possível cancelar agora. Tente de novo em instantes." };
    // O webhook também grava; gravar aqui faz a tela mostrar o cancelamento na hora.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    await supabaseAdmin.rpc("audit", { p_action: "subscription_cancelled_by_user", p_target: context.userId, p_details: { preapproval: sub.preapproval_id } });
    return { error: null };
  });
