// Confere um cupom para uma conta e um período, com o service role. Só no servidor: a tela recebe só o
// preço com desconto e a descrição, nunca a tabela de cupons.
import { couponCycles, describeCoupon, discountedCents, type CouponTerms } from "@/lib/calc/coupon";
import type { BillingPeriod } from "./catalog";
import { currentPriceCents } from "./prices.server";

const INVALID = "Cupom inválido ou vencido." as const;

export type ValidCoupon = {
  id: string;
  code: string;
  affiliateId: string | null;
  terms: CouponTerms;
  fullCents: number;
  amountCents: number;
  cycles: number | null;
  description: string;
};

export function normalizeCoupon(code: string): string | null {
  const c = code.trim().toUpperCase();
  return /^[A-Z0-9]{3,20}$/.test(c) ? c : null;
}

export async function loadCoupon(userId: string, code: string, period: BillingPeriod): Promise<{ error: string; coupon: null } | { error: null; coupon: ValidCoupon }> {
  const c = normalizeCoupon(code);
  if (!c) return { error: INVALID, coupon: null };
  const full = await currentPriceCents("inteligencia", period);
  if (full === null) return { error: INVALID, coupon: null };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin.from("coupons").select("*").eq("code", c).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || !row.active || (row.expires_at && new Date(row.expires_at) <= new Date())) return { error: INVALID, coupon: null };
  if (!row.periods.includes(period)) return { error: `Este cupom não vale para o plano ${period}.`, coupon: null };

  const [{ count, error: countError }, { data: used, error: usedError }] = await Promise.all([
    supabaseAdmin.from("coupon_redemptions").select("user_id", { count: "exact", head: true }).eq("coupon_id", row.id),
    supabaseAdmin.from("coupon_redemptions").select("user_id").eq("coupon_id", row.id).eq("user_id", userId).maybeSingle(),
  ]);
  if (countError || usedError) throw new Error((countError ?? usedError)!.message);
  if (used) return { error: "Você já usou este cupom.", coupon: null };
  if (row.max_uses !== null && (count ?? 0) >= row.max_uses) return { error: "Este cupom já atingiu o limite de usos.", coupon: null };

  const terms: CouponTerms = {
    kind: row.kind as CouponTerms["kind"],
    value: row.value,
    duration: row.duration as CouponTerms["duration"],
    cycles: row.cycles,
  };
  return {
    error: null,
    coupon: {
      id: row.id,
      code: row.code,
      affiliateId: row.affiliate_id,
      terms,
      fullCents: full,
      amountCents: discountedCents(full, terms),
      cycles: couponCycles(terms),
      description: describeCoupon(terms),
    },
  };
}
