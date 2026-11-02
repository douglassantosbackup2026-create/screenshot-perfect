// Catálogo de cobrança: planos e períodos à venda. O preço de hoje fica no banco (plan_prices, editável pelo
// admin); os valores daqui são o ponto de partida, a reserva da tela e o preço das assinaturas antigas.
// Cada assinatura leva na referência do Mercado Pago o preço do dia em que foi feita: o webhook confere o valor
// pago contra ela, então mudar o preço não afeta quem já assina.
import { MIN_CHARGE_CENTS } from "@/lib/calc/coupon";

export type PaidPlan = "inteligencia" | "pro";
export type BillingPeriod = "mensal" | "anual";
export type PlanPrices = Record<PaidPlan, Partial<Record<BillingPeriod, number>>>;

export const DEFAULT_PRICES_CENTS: PlanPrices = {
  inteligencia: { mensal: 3990, anual: 39900 },
  pro: { mensal: 5990 },
};

/** Maior preço aceito numa referência (R$ 100.000), só para barrar valores absurdos. */
export const MAX_PRICE_CENTS = 10_000_000;

export const PLAN_NAMES: Record<PaidPlan, string> = { inteligencia: "Inteligência", pro: "Pro" };

/** Preço de partida (e das assinaturas feitas antes do preço ir para o banco); null se o par não é vendido. */
export function defaultPriceCents(plan: string, period: string): number | null {
  const p = DEFAULT_PRICES_CENTS[plan as PaidPlan];
  return p?.[period as BillingPeriod] ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CENTS = /^\d{1,8}$/;

/**
 * Referência gravada na assinatura: `usuário|plano|período|valor cobrado|preço cheio`, em centavos.
 * O valor cobrado é o com cupom (ou igual ao cheio); depois que o desconto acaba, cobra-se o cheio.
 */
export function buildReference(userId: string, plan: PaidPlan, period: BillingPeriod, amountCents: number, fullCents: number): string {
  return `${userId}|${plan}|${period}|${amountCents}|${fullCents}`;
}

export type Reference = { userId: string; plan: PaidPlan; period: BillingPeriod; amountCents: number; fullCents: number };

/**
 * Lê a referência. Formatos antigos continuam valendo: 3 partes (sem valor) e 4 partes (só o valor com cupom)
 * usam o preço de partida como preço cheio.
 */
export function parseReference(ref: string | null | undefined): Reference | null {
  const parts = (ref ?? "").split("|");
  const [userId, plan, period, amount, full] = parts;
  const legacy = defaultPriceCents(plan ?? "", period ?? "");
  if (!userId || !UUID.test(userId) || legacy === null || parts.length > 5) return null;
  const fullCents = full === undefined ? legacy : CENTS.test(full) ? Number(full) : NaN;
  const amountCents = amount === undefined ? fullCents : CENTS.test(amount) ? Number(amount) : NaN;
  if (!(fullCents >= MIN_CHARGE_CENTS && fullCents <= MAX_PRICE_CENTS && amountCents >= MIN_CHARGE_CENTS && amountCents <= fullCents)) return null;
  return { userId, plan: plan as PaidPlan, period: period as BillingPeriod, amountCents, fullCents };
}

/** Valor do Mercado Pago (reais, decimal) em centavos, sem erro de ponto flutuante. */
export const toCents = (amount: number) => Math.round(amount * 100);
