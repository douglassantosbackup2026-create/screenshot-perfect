// Planos e acesso: o que cada função exige, preços em centavos, referência do pagamento e validade.
// Funções puras. A cobrança só vale com VITE_BILLING_ENABLED=true; sem isso, tudo fica liberado.

export type PaidPlan = "inteligencia" | "pro";
export type Plan = "free" | PaidPlan;
export type Period = "mensal" | "anual";
export type Feature = "importacao" | "orcamento" | "investimentos" | "relatorios_12m";

const LEVEL: Record<Plan, number> = { free: 0, inteligencia: 1, pro: 2 };

/** Plano mínimo de cada função paga. O resto do app é gratuito. */
export const FEATURE_PLAN: Record<Feature, PaidPlan> = {
  importacao: "inteligencia",
  orcamento: "inteligencia",
  investimentos: "inteligencia",
  relatorios_12m: "inteligencia",
};

export const FEATURE_LABEL: Record<Feature, string> = {
  importacao: "Importar extrato do banco",
  orcamento: "Orçamento por envelopes",
  investimentos: "Investimentos e onde aportar",
  relatorios_12m: "Relatórios de 12 meses",
};

/** Preço mensal em centavos; o anual sai por 10 mensalidades. */
export const MONTHLY_CENTS: Record<PaidPlan, number> = { inteligencia: 2990, pro: 5990 };
export function priceCents(plan: PaidPlan, period: Period): number {
  return period === "anual" ? MONTHLY_CENTS[plan] * 10 : MONTHLY_CENTS[plan];
}
export const PERIOD_DAYS: Record<Period, number> = { mensal: 31, anual: 366 };

export interface Entitlement {
  plan: PaidPlan;
  validUntil: string; // ISO
}

/** Plano em vigor agora: pago enquanto a validade não passou; senão, gratuito. */
export function currentPlan(e: Entitlement | null, now = new Date()): Plan {
  return e && new Date(e.validUntil).getTime() > now.getTime() ? e.plan : "free";
}

/**
 * Pode usar a função? Sem cobrança ligada, sim. Com dados já registrados nela, também:
 * seus dados nunca ficam presos atrás do pagamento.
 */
export function canUse(feature: Feature, plan: Plan, opts: { billing: boolean; hasData?: boolean }): boolean {
  if (!opts.billing || opts.hasData) return true;
  return LEVEL[plan] >= LEVEL[FEATURE_PLAN[feature]];
}

/** Referência do pagamento: liga o pagamento à conta, ao plano e ao período. */
export function encodeRef(userId: string, plan: PaidPlan, period: Period): string {
  return `${userId}|${plan}|${period}`;
}
export function decodeRef(ref: string | null | undefined): { userId: string; plan: PaidPlan; period: Period } | null {
  const [userId, plan, period] = (ref ?? "").split("|");
  if (!userId || !/^[0-9a-f-]{36}$/.test(userId)) return null;
  if (plan !== "inteligencia" && plan !== "pro") return null;
  if (period !== "mensal" && period !== "anual") return null;
  return { userId, plan, period };
}

/** Nova validade: a partir do vencimento atual se ainda estiver valendo (renovar antes não perde dias); senão, de agora. */
export function extendValidity(current: string | null, period: Period, now = new Date()): string {
  const base = current && new Date(current).getTime() > now.getTime() ? new Date(current) : now;
  return new Date(base.getTime() + PERIOD_DAYS[period] * 86400000).toISOString();
}
