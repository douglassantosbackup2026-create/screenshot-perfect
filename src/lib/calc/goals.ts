// Metas de valor além da aposentadoria (reserva, viagem, imóvel…): quanto já tem, quanto guardar por
// mês até o prazo e se o ritmo atual chega lá. Funções puras, valores em reais (como Goal.target).
import { futureValue, monthlyRate, requiredContribution } from "./retirement";

export const GOAL_TEMPLATES = ["reserva", "viagem", "imovel", "outro"] as const;
export type GoalTemplate = (typeof GOAL_TEMPLATES)[number];

/** Rendimento real ao ano quando a pessoa não informa (renda fixa conservadora, acima da inflação). */
export const DEFAULT_GOAL_RETURN = 0.03;

/** Limite da busca de prazo: 50 anos. Acima disso a meta "não chega" no ritmo atual. */
const MAX_MONTHS = 600;

/** Quanto já está guardado para a meta: itens do Patrimônio (reais) + saldos de contas (centavos). */
export function goalCurrent(assetValues: number[], accountBalancesCents: number[]): number {
  const assets = assetValues.reduce((t, v) => t + v, 0);
  const accounts = accountBalancesCents.reduce((t, c) => t + c, 0) / 100;
  return Math.max(assets + accounts, 0);
}

/** Meses inteiros de `today` até o mês do prazo (o mês do prazo conta). Prazo no passado → 0. */
export function monthsUntil(today: string, deadline: string): number {
  const idx = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;
  return Math.max(idx(deadline) - idx(today), 0);
}

/** Aporte mensal para chegar a `target` em `months` meses, partindo de `current`. */
export function requiredMonthly(target: number, current: number, months: number, annualReturn = DEFAULT_GOAL_RETURN): number {
  if (current >= target) return 0;
  if (months <= 0) return Math.max(target - current, 0);
  return requiredContribution(target, current, monthlyRate(annualReturn), months);
}

/** Em quantos meses `current` + `monthly` por mês chega a `target`. null se não chega em 50 anos. */
export function monthsToGoal(target: number, current: number, monthly: number, annualReturn = DEFAULT_GOAL_RETURN): number | null {
  if (current >= target) return 0;
  const rm = monthlyRate(annualReturn);
  for (let m = 1; m <= MAX_MONTHS; m++) {
    if (futureValue(current, monthly, rm, m) >= target - 0.005) return m;
  }
  return null;
}

/** sem_ritmo: tem prazo, mas a pessoa não disse quanto guarda por mês. */
export type GoalVerdict = "concluida" | "em_dia" | "atrasada" | "vencida" | "sem_prazo" | "sem_ritmo";

export type GoalPlan = {
  current: number;
  target: number;
  missing: number;
  pct: number;                  // 0 a 1
  monthsLeft: number | null;    // até o prazo; null sem prazo
  requiredMonthly: number | null; // para chegar no prazo; null sem prazo
  etaMonths: number | null;     // no ritmo informado; null sem ritmo ou se não chega
  verdict: GoalVerdict;
};

/**
 * Situação de uma meta de valor. `monthlyContribution` é o que a pessoa diz que guarda por mês
 * (null = não informou): com ele dá para dizer se está em dia; sem ele, só quanto precisa guardar.
 */
export function goalPlan(input: {
  target: number;
  current: number;
  today: string;
  deadline: string | null;
  monthlyContribution: number | null;
  annualReturn?: number | null;
}): GoalPlan {
  const { target, today, deadline, monthlyContribution } = input;
  const current = Math.max(input.current, 0);
  const r = input.annualReturn ?? DEFAULT_GOAL_RETURN;
  const missing = Math.max(target - current, 0);
  const pct = target > 0 ? Math.min(current / target, 1) : 1;
  const monthsLeft = deadline ? monthsUntil(today, deadline) : null;
  const required = monthsLeft === null ? null : requiredMonthly(target, current, monthsLeft, r);
  const eta = monthlyContribution && monthlyContribution > 0 ? monthsToGoal(target, current, monthlyContribution, r) : missing === 0 ? 0 : null;

  let verdict: GoalVerdict;
  if (missing === 0) verdict = "concluida";
  else if (monthsLeft === null) verdict = "sem_prazo";
  else if (monthsLeft === 0) verdict = "vencida";
  else if (!monthlyContribution) verdict = "sem_ritmo";
  else verdict = eta !== null && eta <= monthsLeft ? "em_dia" : "atrasada";

  return { current, target, missing, pct, monthsLeft, requiredMonthly: required, etaMonths: eta, verdict };
}
