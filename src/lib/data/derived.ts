// Leituras do estado: o que as telas e as operações calculam a partir dele, sem alterar nada.
import { type PlanInputs } from "@/lib/calc/retirement";
import { isOnBudget, isSavingsAccount } from "@/lib/calc/ledger";
import { budgetActivity, computeBudget, RETIREMENT_ENVELOPE, type BudgetTxInput } from "@/lib/calc/budget";
import { positionFromTrades, valuePosition } from "@/lib/calc/portfolio";
import { challengeProgress, monthOf, spDate, type ChallengeInputs } from "@/lib/gamification/rules";
import { challengeBySlug } from "@/content/challenges";
import { dailyMission } from "@/lib/journey/journey";
import { Profile, DemoState, DEFAULT_ASSUMPTIONS, MonthStepKey } from "./model";

export const dayOf = (iso: string) => spDate(new Date(iso));

/** Datas que contam para os desafios, derivadas do que já está registrado. */
export function challengeInputs(s: DemoState): ChallengeInputs {
  return {
    missions: s.missionCompletions.map((m) => dayOf(m.at)),
    active_days: s.days,
    wealth_months: s.wealthEntries.map((w) => dayOf(w.createdAt)),
    plan_reviews: s.snapshots.filter((x) => x.reason !== "created").map((x) => dayOf(x.createdAt)),
    goals_completed: s.goals.flatMap((g) => (g.completedAt ? [dayOf(g.completedAt)] : [])),
  };
}

/**
 * Os cinco passos do fechamento do mês atual, cada um conferido pelos próprios dados.
 * Quem não usa o livro-caixa (sem contas) tem os dois primeiros dados como feitos, para não ficar travado.
 * O orçamento conta como feito quando o mês foi planejado; o que ainda está sem destino aparece como dica.
 */
export function monthCloseSteps(s: DemoState, now = new Date()) {
  const month = monthOf(spDate(now));
  const usesLedger = s.accounts.length > 0;
  const inMonth = s.transactions.filter((t) => t.date.slice(0, 7) === month.slice(0, 7));
  const uncategorized = inMonth.filter((t) => !t.transferId && !t.categoryId);
  const steps: { key: MonthStepKey; done: boolean }[] = [
    { key: "lancamentos", done: !usesLedger || inMonth.some((t) => t.source !== "recorrente") },
    { key: "categorias", done: !usesLedger || (inMonth.length > 0 && uncategorized.length === 0) },
    { key: "orcamento", done: Object.values(s.budget.assigned[month] ?? {}).some((v) => v > 0) },
    { key: "aporte", done: s.contributions.some((c) => c.month === month) },
    { key: "patrimonio", done: s.wealthEntries.some((w) => w.month === month) },
  ];
  return {
    month,
    usesLedger,
    steps,
    doneCount: steps.filter((x) => x.done).length,
    complete: steps.every((x) => x.done),
    closed: s.xpEvents.some((e) => e.action === "month_closed" && e.periodKey === "M:" + month.slice(0, 7)),
    uncategorized,
  };
}

/** Valor de mercado das posições de um item, em centavos. */
export function holdingsValue(s: Pick<DemoState, "holdings" | "trades">, assetId: string): number {
  return s.holdings
    .filter((h) => h.assetId === assetId)
    .reduce((t, h) => t + valuePosition(positionFromTrades(s.trades.filter((x) => x.holdingId === h.id)), h.price).marketValue, 0);
}

/** O item está ligado a uma conta do livro-caixa: o valor dele é o saldo da conta. */
export const linkedAccountOf = (s: Pick<DemoState, "accounts">, assetId: string) => s.accounts.find((a) => a.assetId === assetId) ?? null;

/** O item tem posições com operações lançadas: o valor dele vem delas. */
export function valuedByHoldings(s: Pick<DemoState, "holdings" | "trades">, assetId: string): boolean {
  const ids = new Set(s.holdings.filter((h) => h.assetId === assetId).map((h) => h.id));
  return s.trades.some((t) => ids.has(t.holdingId));
}

/** Meses à frente que dá para planejar no orçamento. */
export const BUDGET_MONTHS_AHEAD = 2;

/** Lançamentos no formato do cálculo do orçamento: conta do orçamento ou não, e para onde foi cada transferência. */
export function budgetTxInputs(s: DemoState): BudgetTxInput[] {
  const accounts = new Map(s.accounts.map((a) => [a.id, a]));
  const kinds = new Map(s.categories.map((c) => [c.id, c.kind]));
  const byId = new Map(s.transactions.map((t) => [t.id, t]));
  return s.transactions.flatMap((t) => {
    const acc = accounts.get(t.accountId);
    if (!acc) return [];
    const other = t.transferId ? accounts.get(byId.get(t.transferId)?.accountId ?? "") : undefined;
    return [
      {
        date: t.date,
        amount: t.amount,
        categoryId: t.categoryId,
        categoryKind: t.categoryId ? (kinds.get(t.categoryId) ?? null) : null,
        accountOnBudget: isOnBudget(acc.kind),
        transfer: t.transferId ? { counterpartOnBudget: other ? isOnBudget(other.kind) : false, counterpartSavings: other ? isSavingsAccount(other.kind) : false } : null,
      },
    ];
  });
}

/** Envelopes do orçamento: categorias de gasto e o envelope Aposentadoria. */
export function budgetEnvelopeIds(s: DemoState): string[] {
  return [RETIREMENT_ENVELOPE, ...s.categories.filter((c) => c.kind === "despesa").map((c) => c.id)];
}

/** O orçamento de cada mês, do primeiro mês com movimento ou distribuição até `month`. */
export function budgetMonths(s: DemoState, month: string) {
  const activity = budgetActivity(budgetTxInputs(s));
  const first = [...Object.keys(activity), ...Object.keys(s.budget.assigned), month].sort()[0]!;
  return computeBudget(budgetEnvelopeIds(s), activity, s.budget.assigned, first, monthOf(month));
}

/** Desafios em andamento: nem concluídos nem expirados. */
export function activeChallenges(s: DemoState, now = new Date()) {
  const today = spDate(now);
  const inputs = challengeInputs(s);
  return s.challenges.flatMap((run) => {
    const def = challengeBySlug(run.slug);
    if (!def || run.completedAt) return [];
    const progress = challengeProgress(def, dayOf(run.startedAt), inputs, today);
    return progress.expired ? [] : [{ run, def, progress }];
  });
}

export function planAgeDays(createdAt: string, now = new Date()) {
  return Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86400000);
}

/** Lição de hoje: uma nova por dia (horário de Brasília). */
export const completedDays = (s: DemoState) => Object.keys(s.lessonCompletions).map(Number);

export function todayMission(s: DemoState, now = new Date()) {
  return dailyMission(spDate(now), completedDays(s), s.journey.testedOutUnits);
}

export function dailyMissionDone(s: DemoState, now = new Date()) {
  const today = spDate(now);
  return s.journey.dailyMissions.some((m) => m.day === today);
}

export const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d + "T00:00:00Z"));

/**
 * Plano padrão a partir do onboarding. Sem idade ou renda, usa valores provisórios;
 * quem chama registra o dado em `profile.missingFields` para que apareça como ausente.
 */
export function inputsFromProfile(p: Pick<Profile, "birthYear" | "goalRetirementAge" | "goalIncome">, now = new Date()): PlanInputs {
  const year = Number(spDate(now).slice(0, 4));
  return {
    currentAge: p.birthYear ? year - p.birthYear : 30,
    retirementAge: p.goalRetirementAge ?? 60,
    horizonAge: DEFAULT_ASSUMPTIONS.horizonAge,
    initialWealth: 0,
    monthlyContribution: 0,
    desiredMonthlyIncome: p.goalIncome ?? 5000,
    inssEstimate: null,
    returns: { ...DEFAULT_ASSUMPTIONS.returns },
    inflationAA: DEFAULT_ASSUMPTIONS.inflationAA,
    costsAA: DEFAULT_ASSUMPTIONS.costsAA,
  };
}
