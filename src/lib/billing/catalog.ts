// Catálogo de cobrança: a única fonte dos valores cobrados (em centavos).
// O webhook confere o valor pago contra esta tabela antes de liberar o acesso.
export type PaidPlan = "inteligencia" | "pro";
export type BillingPeriod = "mensal" | "anual";

export const PRICES_CENTS: Record<PaidPlan, Partial<Record<BillingPeriod, number>>> = {
  inteligencia: { mensal: 3990, anual: 39900 },
  pro: { mensal: 5990 },
};

export const PLAN_NAMES: Record<PaidPlan, string> = { inteligencia: "Inteligência", pro: "Pro" };

export function priceCents(plan: string, period: string): number | null {
  const p = PRICES_CENTS[plan as PaidPlan];
  return p?.[period as BillingPeriod] ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildReference(userId: string, plan: PaidPlan, period: BillingPeriod): string {
  return `${userId}|${plan}|${period}`;
}

export function parseReference(ref: string | null | undefined): { userId: string; plan: PaidPlan; period: BillingPeriod } | null {
  const [userId, plan, period] = (ref ?? "").split("|");
  if (!userId || !UUID.test(userId) || priceCents(plan ?? "", period ?? "") === null) return null;
  return { userId, plan: plan as PaidPlan, period: period as BillingPeriod };
}

/** Valor do Mercado Pago (reais, decimal) em centavos, sem erro de ponto flutuante. */
export const toCents = (amount: number) => Math.round(amount * 100);
