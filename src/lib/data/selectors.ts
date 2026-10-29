import { simulateAll } from "@/lib/calc/retirement";
import { isoWeekKey, levelFromXp, monthOf, spDate, weekStartOf } from "@/lib/gamification/rules";
import { MISSIONS } from "@/content/missions";
import { fiProgress, wealthTimeline } from "@/lib/calc/progress";
import { challengeBySlug } from "@/content/challenges";
import { isIncomeSource, isLiability, summarizeAssets } from "@/lib/calc/assets";
import { assetHistory, cumulativeReturn, fiMilestones, growthSummary, periodReturns, snapshotFromAssets } from "@/lib/calc/networth";
import { accountBalances, accountGroup, groupByDay, isOnBudget, monthSummary, spendingByCategory, type AccountGroup } from "@/lib/calc/ledger";
import { aboveAverage, budgetAlertCrossed, budgetAlertLevel, budgetAlerts, duplicateCharges, priceChanges, type AnomalyTx, type BudgetAlertLevel } from "@/lib/calc/alerts";
import { committedByMonth, installmentAt } from "@/lib/calc/installments";
import { monthEndProjection, type ScheduledFlow } from "@/lib/calc/forecast";
import { averageMonthlySpending, emergencyFund } from "@/lib/calc/reserve";
import { LIMIT_PERIODS, limitUsage } from "@/lib/calc/limits";
import { applyRules } from "@/lib/calc/categorize";
import { parseEntry } from "@/lib/calc/quickEntry";
import { monthsToPayoff, payoffVsInvest } from "@/lib/calc/debt";
import { wealthXray } from "@/lib/calc/xray";
import { addDays, nextOccurrence, occurrencesUntil } from "@/lib/calc/recurring";
import { cashFlowSeries, cashFlowTotals, categoryTrend, OTHER_KEY, UNCATEGORIZED_KEY, WEALTH_GROUPS, wealthByGroup } from "@/lib/calc/reports";
import {
  DEBT_ENVELOPE,
  monthsBetween,
  RETIREMENT_ENVELOPE,
  retirementImpact,
  shiftMonth,
  templateAmount,
  templateProgress,
  UNCATEGORIZED_ENVELOPE,
} from "@/lib/calc/budget";
import { journeyNodes } from "@/lib/journey/journey";
import { UNITS } from "@/content/journey";
import {
  allocateContribution,
  allocation,
  classOfCategory,
  positionFromTrades,
  tradeFlows,
  valuePosition,
  returnSummary,
  type AssetClass,
} from "@/lib/calc/portfolio";
import {
  budgetMonths,
  memoOnState,
  monthCloseSteps,
  ruleAmount,
  UNDO_WINDOW_MS,
  valuedByHoldings,
  completedDays,
  dailyMissionDone,
  todayMission,
  type Account,
  type DemoState,
  type Destination,
  type MissingField,
  type RecurringRule,
  type ReviewCadence,
  type Transaction,
} from "./demo-store";
import { planCorridor, progressVerdict, retirementImpact as trackingImpact } from "@/lib/calc/tracking";
import { monthYear } from "@/lib/labels";

/**
 * Projetado × real: o patrimônio para a aposentadoria registrado, comparado com a foto ancorada do plano.
 * Sem plano salvo, null.
 */
export function progressTracking(s: DemoState, now = new Date()) {
  const oldest = s.snapshots[s.snapshots.length - 1];
  if (!oldest) return null;
  const anchor = s.snapshots.find((x) => x.id === s.anchorSnapshotId) ?? oldest;
  const anchorMonth = monthOf(spDate(new Date(anchor.createdAt)));
  const entries = s.wealthEntries.map((w) => ({ month: w.month, total: w.previdencia ?? w.total }));
  const points = planCorridor(anchor.inputs, anchorMonth, entries, monthOf(spDate(now)));
  const verdict = progressVerdict(points);
  const impact = verdict ? trackingImpact(anchor.inputs, anchorMonth, verdict.month, verdict.actual) : null;
  return { anchor, anchorMonth, points, verdict, impact, isLatestPlan: anchor.id === s.snapshots[0]!.id };
}

/** Missão da semana: segue a ordem e recomeça quando a lista termina. */
export function missionOfWeek(s: DemoState, now = new Date()) {
  const week = isoWeekKey(weekStartOf(spDate(now)));
  const doneThisWeek = s.missionCompletions.find((m) => m.isoWeek === week);
  const idx = (s.missionCompletions.length - (doneThisWeek ? 1 : 0)) % MISSIONS.length;
  return { mission: MISSIONS[idx] ?? MISSIONS[0]!, done: !!doneThisWeek };
}

export function planSummary(s: DemoState) {
  if (!s.plan) return null;
  const r = simulateAll(s.plan.inputs).semInss.central;
  return { required: r.requiredMonthlyContribution, current: s.plan.inputs.monthlyContribution, result: r };
}

/** Patrimônio mais recente registrado; sem registro, o valor informado no plano. */
export function currentWealth(s: DemoState): number {
  const last = [...s.wealthEntries].sort((a, b) => a.month.localeCompare(b.month)).at(-1);
  return last?.total ?? s.plan?.inputs.initialWealth ?? 0;
}

export function activeGoals(s: DemoState) {
  return s.goals.filter((g) => !g.completedAt);
}

function hasWealthRecord(s: DemoState, now = new Date()) {
  const m = monthOf(spDate(now));
  return s.wealthEntries.some((w) => w.month === m);
}

export type ActivityKind = "aporte" | "patrimonio" | "meta" | "desafio";
export type ActivityItem = {
  key: string;
  /** Data para ordenar: "YYYY-MM-01" (mês) ou ISO. */
  at: string;
  kind: ActivityKind;
  title: string;
  /** Mês de referência, para registros mensais. */
  month: string | null;
  amount: number | null;
  /** Variação em relação ao registro anterior (só patrimônio). */
  delta: number | null;
  destination: Destination | null;
};

/** Aportes, registros de patrimônio, metas e desafios concluídos, do mais recente para o mais antigo. */
export function recentActivity(s: DemoState, limit = Infinity): ActivityItem[] {
  const items: ActivityItem[] = [
    ...wealthTimeline(s.wealthEntries).map((p) => ({
      key: `w-${p.month}`,
      at: p.month,
      kind: "patrimonio" as const,
      title: "Patrimônio registrado",
      month: p.month,
      amount: p.total,
      delta: p.deltaFromPrevious,
      destination: null,
    })),
    ...s.contributions
      .filter((c) => c.made)
      .map((c) => ({
        key: `c-${c.id}`,
        at: c.month,
        kind: "aporte" as const,
        title: "Aporte",
        month: c.month,
        amount: c.amount,
        delta: null,
        destination: c.destination,
      })),
    ...s.goals.flatMap((g) =>
      g.completedAt
        ? [{ key: `g-${g.id}`, at: g.completedAt, kind: "meta" as const, title: g.title, month: null, amount: null, delta: null, destination: null }]
        : [],
    ),
    ...s.challenges.flatMap((c) => {
      const def = challengeBySlug(c.slug);
      return c.completedAt && def
        ? [{ key: `d-${c.slug}-${c.startedAt}`, at: c.completedAt, kind: "desafio" as const, title: def.title, month: null, amount: null, delta: null, destination: null }]
        : [];
    }),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/**
 * Crescimento do patrimônio registrado, separando aportes do resto (rendimento, saques, ajustes).
 * Aportes para a reserva ficam de fora: a reserva não entra no total para a aposentadoria.
 */
export function wealthGrowth(s: DemoState) {
  const flows = s.contributions
    .filter((c) => c.made && c.amount && c.destination !== "reserva")
    .map((c) => ({ month: c.month, amount: c.amount! }));
  const timeline = wealthTimeline(s.wealthEntries, flows);
  const returns = periodReturns(timeline);
  return {
    timeline,
    returns,
    summary: growthSummary(timeline),
    cumulativeReturn: cumulativeReturn(returns.map((r) => r.rate)),
  };
}

/** Histórico de cada item do patrimônio, pelo id. */
export function assetHistories(s: DemoState) {
  return new Map(s.assets.map((a) => [a.id, assetHistory(s.assetValuations, a.id)]));
}

/** Foto do mês a partir dos itens; null sem itens. */
export function assetSnapshot(s: DemoState) {
  return s.assets.length ? snapshotFromAssets(s.assets) : null;
}

/** Marcos de 25/50/75/100% do patrimônio-alvo; null sem plano. */
export function milestones(s: DemoState) {
  if (!s.plan) return null;
  return fiMilestones(fiProgress(s.plan.inputs, currentWealth(s)).ratio);
}

// ---------- Livro-caixa ----------
export type LedgerRow = Transaction & { accountName: string; categoryName: string | null; installment: { number: number; count: number } | null };

/** Lançamentos do mês, com nomes de conta e categoria, agrupados por dia, mais o resumo e os gastos por categoria. */
export function ledgerMonth(s: DemoState, month: string, accountId: string | null = null) {
  return memoOnState(s, `ledgerMonth:${month}:${accountId ?? ""}`, (t) => ledgerMonthUncached(t, month, accountId));
}
function ledgerMonthUncached(s: DemoState, month: string, accountId: string | null) {
  const accounts = new Map(s.accounts.map((a) => [a.id, a.name]));
  const categories = new Map(s.categories.map((c) => [c.id, c.name]));
  const rules = new Map(s.recurring.map((r) => [r.id, r]));
  const scoped = accountId ? s.transactions.filter((t) => t.accountId === accountId) : s.transactions;
  const rows: LedgerRow[] = scoped
    .filter((t) => t.date.slice(0, 7) === month.slice(0, 7))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map((t) => ({
      ...t,
      accountName: accounts.get(t.accountId) ?? "Conta removida",
      categoryName: t.categoryId ? (categories.get(t.categoryId) ?? null) : null,
      installment: installmentOf(t.recurringId ? rules.get(t.recurringId) : undefined, t.occurrenceDate),
    }));
  return {
    days: groupByDay(rows),
    summary: monthSummary(scoped, month),
    byCategory: spendingByCategory(scoped, month).map((c) => ({ ...c, name: c.categoryId ? (categories.get(c.categoryId) ?? "Sem categoria") : "Sem categoria" })),
    uncategorized: rows.filter((t) => !t.transferId && !t.categoryId).length,
  };
}

/** Ocorrências já resolvidas ("regra|data nominal"): lançadas ou excluídas pela pessoa. */
function handledOccurrences(s: DemoState) {
  return memoOnState(s, "handledOccurrences", (st) => new Set([
    ...st.transactions.flatMap((t) => (t.recurringId && t.occurrenceDate ? [`${t.recurringId}|${t.occurrenceDate}`] : [])),
    ...st.recurring.flatMap((r) => (r.skipped ?? []).map((d) => `${r.id}|${d}`)),
  ]));
}

/** "3 de 10": a parcela que este lançamento representa, se veio de uma compra parcelada. */
function installmentOf(rule: RecurringRule | undefined, occurrenceDate: string | null) {
  if (!rule?.installment || !occurrenceDate) return null;
  const i = installmentAt(rule.installment.total, rule.installment.count, rule.startDate, occurrenceDate);
  return i ? { number: i.number, count: rule.installment.count } : null;
}

const ACCOUNT_GROUP_LABEL: Record<AccountGroup, string> = {
  dia_a_dia: "Dia a dia",
  investimentos: "Previdência e investimentos",
  dividas: "Cartões e dívidas",
};

/** Contas com saldo, por grupo. Em cartões e dívidas, saldo negativo é o que se deve. */
export function accountsOverview(s: DemoState) {
  return memoOnState(s, "accountsOverview", (t) => accountsOverviewUncached(t));
}
function accountsOverviewUncached(s: DemoState) {
  const balances = accountBalances(s.accounts, s.transactions);
  const withBalance = s.accounts.map((a) => ({ ...a, balance: balances[a.id] ?? 0 }));
  const groups = (Object.keys(ACCOUNT_GROUP_LABEL) as AccountGroup[]).map((g) => {
    const accounts = withBalance.filter((a) => accountGroup(a.kind) === g);
    return { group: g, label: ACCOUNT_GROUP_LABEL[g], accounts, total: accounts.reduce((t, a) => t + a.balance, 0) };
  });
  return { groups, total: withBalance.reduce((t, a) => t + a.balance, 0) };
}

/** Próximas ocorrências das recorrências ativas nos próximos `days` dias, da mais próxima para a mais distante. */
export function upcomingRecurring(s: DemoState, now = new Date(), days = 31) {
  const today = spDate(now);
  const limit = addDays(today, days);
  const accounts = new Map<string, Account>(s.accounts.map((a) => [a.id, a]));
  return s.recurring
    .filter((r) => r.active)
    .flatMap((r) => {
      const next = nextOccurrence(r, today);
      return next && next.date <= limit ? [{ rule: r, date: next.date, accountName: accounts.get(r.accountId)?.name ?? "Conta removida" }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- Orçamento ----------
const SPECIAL_ENVELOPES: Record<string, string> = {
  [RETIREMENT_ENVELOPE]: "Aposentadoria",
  [DEBT_ENVELOPE]: "Pagamento de dívidas",
  [UNCATEGORIZED_ENVELOPE]: "Gastos sem categoria",
};

/**
 * Tudo o que a aba Orçamento mostra para o mês: "a distribuir", cada envelope com o que o modelo pede,
 * e o envelope Aposentadoria comparado com o plano.
 */
export function budgetView(s: DemoState, month: string) {
  const months = budgetMonths(s, month);
  const cur = months.at(-1)!;
  const names = new Map(s.categories.map((c) => [c.id, c.name]));
  const templates = new Map(s.budget.templates.map((t) => [t.envelopeId, t]));
  const envelopes = Object.entries(cur.envelopes)
    .filter(([id, e]) => id === RETIREMENT_ENVELOPE || names.has(id) || e.balance !== 0 || e.activity !== 0)
    .map(([id, e]) => {
      const template = templates.get(id) ?? null;
      return {
        id,
        name: SPECIAL_ENVELOPES[id] ?? names.get(id) ?? "Categoria removida",
        ...e,
        template,
        suggested: template ? templateAmount(template, cur.month, e.carry, cur.income) : null,
        progress: template ? templateProgress(template, e.balance) : null,
        /** Quanto do que havia no envelope (saldo anterior + distribuído) já foi gasto. */
        used: e.carry + e.assigned > 0 ? Math.max(-e.activity, 0) / (e.carry + e.assigned) : null,
        alert: id === RETIREMENT_ENVELOPE || id === DEBT_ENVELOPE ? null : budgetAlertLevel(e.carry + e.assigned, -e.activity),
      };
    });
  const retirement = envelopes.find((e) => e.id === RETIREMENT_ENVELOPE)!;
  const spending = envelopes.filter((e) => e.id !== RETIREMENT_ENVELOPE).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return {
    month: cur,
    retirement,
    spending,
    overspentNow: spending.filter((e) => e.balance < 0),
    impact: s.plan ? retirementImpact(s.plan.inputs, retirement.assigned) : null,
    hasTemplates: s.budget.templates.length > 0,
  };
}

/** Contas fixas do mês (recorrências de saída): previsto, já lançado e a vencer. */
export function billsOfMonth(s: DemoState, month: string, now = new Date()) {
  return memoOnState(s, `billsOfMonth:${month}:${spDate(now)}`, (t) => billsOfMonthUncached(t, month, now));
}
function billsOfMonthUncached(s: DemoState, month: string, now: Date) {
  const today = spDate(now);
  const end = addDays(shiftMonth(month, 1), -1);
  const launched = handledOccurrences(s);
  const items = s.recurring
    .filter((r) => r.active && r.amount < 0)
    .flatMap((r) =>
      occurrencesUntil(r, end)
        .filter((o) => o.date.slice(0, 7) === month.slice(0, 7) && !(r.skipped ?? []).includes(o.occurrenceDate))
        .map((o) => ({
          rule: r,
          date: o.date,
          status: launched.has(`${r.id}|${o.occurrenceDate}`) ? ("lancada" as const) : o.date > today ? ("a_vencer" as const) : ("pendente" as const),
        })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const total = items.reduce((t, i) => t - i.rule.amount, 0);
  const done = items.filter((i) => i.status === "lancada").reduce((t, i) => t - i.rule.amount, 0);
  return { items, total, done, remaining: total - done };
}

// ---------- Relatórios ----------
/** Fluxo de caixa, gastos por categoria e patrimônio por grupo nos últimos `count` meses, terminando no atual. */
export function reportsView(s: DemoState, count: number, now = new Date()) {
  return memoOnState(s, `reportsView:${count}:${spDate(now)}`, (t) => reportsViewUncached(t, count, now));
}
function reportsViewUncached(s: DemoState, count: number, now = new Date()) {
  const end = monthOf(spDate(now));
  const months = Array.from({ length: count }, (_, i) => shiftMonth(end, i - count + 1));
  // As cores das categorias saem da classificação de todo o histórico, para não mudarem com o período.
  const first = [...s.transactions.map((t) => t.date.slice(0, 8) + "01")].sort()[0] ?? end;
  const history = first < months[0]! ? [...monthsBetween(first, shiftMonth(months[0]!, -1)), ...months] : months;
  const flow = cashFlowSeries(s.transactions, months);
  const names = new Map(s.categories.map((c) => [c.id, c.name]));
  const trend = categoryTrend(s.transactions, months, history);
  const wealth = wealthByGroup(s.assets, s.assetValuations, months);
  const groups = WEALTH_GROUPS.filter((g) => wealth.some((r) => r[g.key] > 0));
  return {
    months,
    flow,
    flowTotals: cashFlowTotals(flow),
    trend: {
      ...trend,
      labels: Object.fromEntries(
        trend.keys.map((k) => [k, k === OTHER_KEY ? "Outros gastos" : k === UNCATEGORIZED_KEY ? "Sem categoria" : (names.get(k) ?? "Categoria removida")]),
      ),
    },
    wealth,
    wealthGroups: groups,
    hasLedger: s.transactions.length > 0,
    hasWealthHistory: s.assetValuations.length > 0,
  };
}

// ---------- Investimentos ----------
const STALE_PRICE_DAYS = 31;

/**
 * Carteira: cada posição pelo preço médio, os totais, a alocação dos itens para a aposentadoria por classe
 * (itens sem posições entram pela categoria) e a rentabilidade anual (XIRR) das posições.
 */
export function portfolioView(s: DemoState, now = new Date()) {
  return memoOnState(s, `portfolioView:${spDate(now)}`, (t) => portfolioViewUncached(t, now));
}
function portfolioViewUncached(s: DemoState, now = new Date()) {
  const today = spDate(now);
  const assets = new Map(s.assets.map((a) => [a.id, a]));
  const positions = s.holdings.map((h) => {
    const trades = s.trades.filter((t) => t.holdingId === h.id).sort((a, b) => b.date.localeCompare(a.date));
    return {
      holding: h,
      assetName: assets.get(h.assetId)?.name ?? "Item removido",
      trades,
      ...valuePosition(positionFromTrades(trades), h.price),
      stalePrice: (now.getTime() - new Date(h.priceUpdatedAt).getTime()) / DAY_MS > STALE_PRICE_DAYS,
    };
  });
  const totals = positions.reduce(
    (t, p) => ({
      marketValue: t.marketValue + p.marketValue,
      costBasis: t.costBasis + p.costBasis,
      unrealized: t.unrealized + p.unrealized,
      realized: t.realized + p.realized,
      income: t.income + p.income,
    }),
    { marketValue: 0, costBasis: 0, unrealized: 0, realized: 0, income: 0 },
  );
  // Alocação do que é para a aposentadoria: posições onde houver; senão, o valor do item pela categoria.
  const forRetirement = s.assets.filter((a) => a.forRetirement && !isLiability(a.category) && !isIncomeSource(a.category));
  const items = forRetirement.flatMap((a) =>
    valuedByHoldings(s, a.id)
      ? positions.filter((p) => p.holding.assetId === a.id).map((p) => ({ assetClass: p.holding.assetClass, value: p.marketValue }))
      : [{ assetClass: classOfCategory(a.category), value: Math.round(a.value * 100) }],
  );
  const current: Partial<Record<AssetClass, number>> = {};
  for (const i of items) current[i.assetClass] = (current[i.assetClass] ?? 0) + i.value;
  return {
    positions,
    totals,
    allocation: allocation(items, s.allocationTargets),
    current,
    performance: returnSummary(tradeFlows(s.trades, totals.marketValue, today)),
    hasTargets: Object.keys(s.allocationTargets).length > 0,
    stalePrices: positions.filter((p) => p.stalePrice && p.quantity > 0).length,
  };
}

/**
 * "Onde aportar este mês": o que falta transferir no envelope Aposentadoria ou, sem orçamento, o aporte do plano,
 * dividido entre as classes para chegar perto das metas, só comprando.
 */
export function contributionSuggestion(s: DemoState, now = new Date()) {
  const month = monthOf(spDate(now));
  const env = budgetMonths(s, month).at(-1)?.envelopes[RETIREMENT_ENVELOPE];
  const fromBudget = env && env.balance > 0 ? env.balance : 0;
  const amount = fromBudget || Math.round((s.plan?.inputs.monthlyContribution ?? 0) * 100);
  const v = portfolioView(s, now);
  if (!v.hasTargets || amount <= 0) return { amount, source: fromBudget ? ("orcamento" as const) : ("plano" as const), items: [], hasTargets: v.hasTargets };
  return {
    amount,
    source: fromBudget ? ("orcamento" as const) : ("plano" as const),
    items: allocateContribution(v.current, s.allocationTargets, amount),
    hasTargets: true,
  };
}

export type DataWarning = {
  key: string;
  message: string;
  to: "/plano" | "/patrimonio" | "/evolucao";
};

const MISSING_LABEL: Record<MissingField, string> = {
  idade: "Sua idade ainda não foi informada; o plano usa um valor provisório.",
  renda: "A renda desejada na aposentadoria ainda não foi informada; o plano usa um valor provisório.",
  patrimonio: "O patrimônio atual para a aposentadoria ainda não foi informado.",
  aporte: "O aporte mensal ainda não foi informado.",
};
const CADENCE_DAYS: Record<ReviewCadence, number> = { mensal: 31, trimestral: 92, semestral: 183 };
const STALE_ASSET_DAYS = 90;
const DAY_MS = 86400000;

/** Dados ausentes ou premissas desatualizadas que deixam a estimativa menos confiável. */
export function dataWarnings(s: DemoState, now = new Date()): DataWarning[] {
  const out: DataWarning[] = s.profile.missingFields.map((f) => ({
    key: "missing-" + f,
    message: MISSING_LABEL[f],
    to: f === "patrimonio" ? "/patrimonio" : "/plano",
  }));
  if (!s.plan) return out;
  const tracking = progressTracking(s, now);
  if (tracking?.verdict?.code === "atras")
    out.push({
      key: "abaixo-do-plano",
      message: `Seu patrimônio ficou abaixo do cenário conservador do plano em ${monthYear(tracking.verdict.month).toLowerCase()}.`,
      to: "/evolucao",
    });
  if (s.plan.inputs.inssEstimate === null)
    out.push({ key: "inss", message: "Sem estimativa do INSS: o plano considera só o seu patrimônio.", to: "/plano" });
  const ageDays = (now.getTime() - new Date(s.plan.updatedAt).getTime()) / DAY_MS;
  if (ageDays > CADENCE_DAYS[s.profile.reviewCadence])
    out.push({ key: "plano-antigo", message: `As premissas do plano não são revisadas há ${Math.floor(ageDays)} dias.`, to: "/plano" });
  if (s.assets.length) {
    const sum = summarizeAssets(s.assets);
    if (sum.oldestUpdate && (now.getTime() - new Date(sum.oldestUpdate).getTime()) / DAY_MS > STALE_ASSET_DAYS)
      out.push({ key: "patrimonio-antigo", message: "Há itens do patrimônio sem atualização há mais de 90 dias.", to: "/patrimonio" });
    if (Math.abs(sum.retirementTotal - s.plan.inputs.initialWealth) >= 1)
      out.push({ key: "patrimonio-divergente", message: "O patrimônio para a aposentadoria cadastrado é diferente do usado no plano.", to: "/patrimonio" });
    // Depois do dia do lembrete, sem registro do mês: os itens cadastrados já bastam para registrar.
    const today = spDate(now);
    if (!hasWealthRecord(s, now) && Number(today.slice(8, 10)) >= s.profile.reminderDay)
      out.push({ key: "patrimonio-do-mes", message: "O patrimônio deste mês ainda não foi registrado.", to: "/patrimonio" });
  }
  return out;
}

/** Compara o cenário central (sem INSS) da última versão do plano com a anterior. */
export function sinceLastReview(s: DemoState) {
  const [last, prev] = s.snapshots;
  if (!last || !prev) return null;
  const a = simulateAll(prev.inputs).semInss.central;
  const b = simulateAll(last.inputs).semInss.central;
  return {
    since: prev.createdAt,
    reviewedAt: last.createdAt,
    coverageBefore: a.coverageRatio,
    coverageNow: b.coverageRatio,
    deltaSustainableIncome: b.sustainableMonthlyIncome - a.sustainableMonthlyIncome,
    deltaGap: b.gap - a.gap,
  };
}

/** Tudo o que a tela Jornada precisa: mapa, unidade atual, nível e missão do dia. */
export function journeyHome(s: DemoState, now = new Date()) {
  const nodes = journeyNodes(completedDays(s), s.journey.testedOutUnits);
  const current = nodes.find((n) => n.status === "current") ?? null;
  const unit = UNITS.find((u) => u.n === current?.unit) ?? null;
  return {
    nodes,
    current,
    unit,
    finished: !current,
    level: levelFromXp(s.stats.totalXp),
    mission: todayMission(s, now),
    missionDone: dailyMissionDone(s, now),
  };
}

// ---------- Dia a dia: avisos, fim do mês, parcelas e reserva ----------
export type DailyAlert =
  | { kind: "orcamento"; key: string; level: BudgetAlertLevel; envelopeName: string; pct: number; spent: number; available: number }
  | { kind: "duplicado"; key: string; payee: string; amount: number; dates: string[]; ids: string[] }
  | { kind: "preco"; key: string; payee: string; before: number; after: number; ids: string[] }
  | { kind: "acima_media"; key: string; name: string; isCard: boolean; current: number; average: number; pct: number }
  | { kind: "limite"; key: string; level: BudgetAlertLevel; name: string; per: string; spent: number; limit: number; pct: number };

/**
 * Avisos do mês, na ordem em que valem atenção: envelope no limite, cobrança repetida, preço que mudou
 * e gasto acima da média. Os que a pessoa ignorou não voltam; os de orçamento valem só para o mês corrente.
 */
export function dailyAlerts(s: DemoState, now = new Date()) {
  return memoOnState(s, `dailyAlerts:${spDate(now)}`, (t) => dailyAlertsUncached(t, now));
}
function dailyAlertsUncached(s: DemoState, now = new Date()): DailyAlert[] {
  const today = spDate(now);
  const month = monthOf(today);
  const dismissed = new Set(s.dismissedAlerts ?? []);
  const names = new Map(s.categories.map((c) => [c.id, c.name]));
  const accounts = new Map(s.accounts.map((a) => [a.id, a]));
  const out: DailyAlert[] = [];

  const cur = budgetMonths(s, month).at(-1);
  for (const a of cur ? budgetAlerts(cur.envelopes) : []) {
    const envelopeName = a.envelopeId === UNCATEGORIZED_ENVELOPE ? "Gastos sem categoria" : (names.get(a.envelopeId) ?? "Categoria removida");
    out.push({ kind: "orcamento", key: `orcamento:${a.envelopeId}:${month}:${a.level}`, level: a.level, envelopeName, pct: a.pct, spent: a.spent, available: a.available });
  }

  for (const l of limitsView(s, now)) {
    if (!l.level) continue;
    out.push({ kind: "limite", key: `limite:${l.id}:${l.start}:${l.level}`, level: l.level, name: l.name, per: l.per, spent: l.spent, limit: l.limit, pct: l.pct });
  }

  const txs: AnomalyTx[] = s.transactions.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    date: t.date,
    amount: t.amount,
    payee: t.payee,
    categoryId: t.categoryId,
    transferId: t.transferId,
    scheduled: t.source === "recorrente",
  }));
  const since = addDays(today, -30);
  for (const d of duplicateCharges(txs, since)) out.push({ kind: "duplicado", key: d.key, payee: d.payee, amount: d.amount, dates: d.dates, ids: d.ids });
  for (const p of priceChanges(txs, since)) out.push({ kind: "preco", key: p.key, payee: p.payee, before: p.before, after: p.after, ids: p.ids });

  const spend = s.transactions
    .filter((t) => !t.transferId && t.amount < 0)
    .flatMap((t) => {
      const items = t.categoryId ? [{ group: t.categoryId, date: t.date, amount: t.amount }] : [];
      if (accounts.get(t.accountId)?.kind === "cartao") items.push({ group: "conta:" + t.accountId, date: t.date, amount: t.amount });
      return items;
    });
  for (const a of aboveAverage(spend, month)) {
    const isCard = a.group.startsWith("conta:");
    const name = isCard ? (accounts.get(a.group.slice(6))?.name ?? "Cartão") : (names.get(a.group) ?? "Categoria");
    out.push({ kind: "acima_media", key: a.key, name, isCard, current: a.current, average: a.average, pct: a.pct });
  }
  return out.filter((a) => !dismissed.has(a.key));
}

/** Ocorrências agendadas entre `from` (exclusive) e `until` que ainda não foram lançadas, com o valor certo. */
function scheduledFlows(s: DemoState, from: string, until: string, rules: RecurringRule[]): (ScheduledFlow & { rule: RecurringRule })[] {
  const launched = handledOccurrences(s);
  return rules
    .filter((r) => r.active)
    .flatMap((r) =>
      occurrencesUntil(r, until)
        .filter((o) => o.date > from && !launched.has(`${r.id}|${o.occurrenceDate}`))
        .map((o) => ({ date: o.date, amount: ruleAmount(r, o.occurrenceDate), label: r.payee, rule: r })),
    );
}

/** Fim do mês nas contas do dia a dia (inclusive cartão): saldo de hoje + o que está agendado até o último dia. */
export function monthProjection(s: DemoState, now = new Date()) {
  return memoOnState(s, `monthProjection:${spDate(now)}`, (t) => monthProjectionUncached(t, now));
}
function monthProjectionUncached(s: DemoState, now = new Date()) {
  const today = spDate(now);
  const monthEnd = addDays(shiftMonth(monthOf(today), 1), -1);
  const onBudget = s.accounts.filter((a) => isOnBudget(a.kind));
  if (!onBudget.length) return null;
  const ids = new Set(onBudget.map((a) => a.id));
  const balances = accountBalances(onBudget, s.transactions, today);
  const balanceToday = Object.values(balances).reduce((t, v) => t + v, 0);
  const flows = scheduledFlows(s, today, monthEnd, s.recurring.filter((r) => ids.has(r.accountId)));
  return { ...monthEndProjection(balanceToday, today, monthEnd, flows), monthEnd };
}

/** Compras parceladas em andamento e quanto delas ainda cai em cada um dos próximos meses. */
export function installmentsView(s: DemoState, now = new Date(), months = 6) {
  return memoOnState(s, `installmentsView:${months}:${spDate(now)}`, (t) => installmentsViewUncached(t, now, months));
}
function installmentsViewUncached(s: DemoState, now = new Date(), months = 6) {
  const today = spDate(now);
  const rules = s.recurring.filter((r) => r.active && r.installment);
  const until = addDays(shiftMonth(monthOf(today), months), -1);
  const future = scheduledFlows(s, today, until, rules);
  const purchases = rules
    .map((r) => {
      const left = scheduledFlows(s, today, r.endDate ?? until, [r]);
      return { rule: r, count: r.installment!.count, left: left.length, remaining: left.reduce((t, f) => t - f.amount, 0) };
    })
    .filter((p) => p.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining);
  return {
    purchases,
    byMonth: committedByMonth(
      future.map((f) => ({ date: f.date, amount: -f.amount })),
      today,
      months,
    ),
    total: purchases.reduce((t, p) => t + p.remaining, 0),
  };
}

/** Categorias que entram no custo essencial da reserva, além de toda conta fixa (recorrência). */
const ESSENTIAL_CATEGORIES = new Set(["cat-moradia", "cat-mercado", "cat-transporte", "cat-saude", "cat-educacao", "cat-impostos"]);

/**
 * Reserva de emergência: custo essencial (média dos 3 meses fechados) × 6.
 * O guardado vem dos itens "Reserva de emergência" do Patrimônio; sem eles, do saldo das poupanças.
 */
export function emergencyFundView(s: DemoState, now = new Date()) {
  return memoOnState(s, `emergencyFundView:${spDate(now)}`, (t) => emergencyFundViewUncached(t, now));
}
function emergencyFundViewUncached(s: DemoState, now: Date) {
  const month = monthOf(spDate(now));
  const window = [shiftMonth(month, -3), shiftMonth(month, -2), shiftMonth(month, -1)];
  const essential = s.transactions.filter(
    (t) => !t.transferId && t.amount < 0 && (t.recurringId !== null || (t.categoryId !== null && ESSENTIAL_CATEGORIES.has(t.categoryId))),
  );
  const monthlyEssential = averageMonthlySpending(essential, window);
  const reserveAssets = s.assets.filter((a) => a.category === "reserva");
  const savings = s.accounts.filter((a) => a.kind === "poupanca");
  const balances = accountBalances(savings, s.transactions);
  const current = reserveAssets.length
    ? Math.round(reserveAssets.reduce((t, a) => t + a.value, 0) * 100)
    : savings.reduce((t, a) => t + (balances[a.id] ?? 0), 0);
  return {
    ...emergencyFund(monthlyEssential, current),
    source: reserveAssets.length ? ("patrimonio" as const) : savings.length ? ("poupanca" as const) : null,
  };
}

/** O "Desfazer" ainda vale? (24 horas desde a última mudança nos lançamentos.) */
export function undoAvailable(s: DemoState, now = new Date()) {
  const u = s.lastAction;
  return u && now.getTime() - new Date(u.at).getTime() <= UNDO_WINDOW_MS ? u : null;
}

/**
 * Como fica o envelope da categoria depois de uma saída de `cents` em `date`: o gasto do mês e se o
 * lançamento fez o envelope mudar de nível (para o recibo e o aviso logo depois de lançar).
 */
export function envelopeAfterExpense(s: DemoState, categoryId: string | null, date: string, cents: number) {
  if (!categoryId || cents <= 0) return null;
  const e = budgetMonths(s, monthOf(date)).at(-1)?.envelopes[categoryId];
  const available = e ? e.carry + e.assigned : 0;
  const spentBefore = e ? Math.max(-e.activity, 0) : 0;
  const spentAfter = spentBefore + cents;
  return {
    name: s.categories.find((c) => c.id === categoryId)?.name ?? "Categoria",
    spentAfter,
    available,
    crossed: budgetAlertCrossed(budgetAlertLevel(available, spentBefore), budgetAlertLevel(available, spentAfter)),
  };
}

/** Limites de gasto com o quanto já foi usado no período atual de cada um. */
export function limitsView(s: DemoState, now = new Date()) {
  return memoOnState(s, `limitsView:${spDate(now)}`, (t) => limitsViewUncached(t, now));
}
function limitsViewUncached(s: DemoState, now: Date) {
  const today = spDate(now);
  const names = new Map(s.categories.map((c) => [c.id, c.name]));
  return (s.limits ?? [])
    .filter((l) => l.active)
    .map((l) => ({
      ...l,
      ...limitUsage(s.transactions, l, today),
      name: l.categoryId ? (names.get(l.categoryId) ?? "Categoria removida") : "Todos os gastos",
      per: LIMIT_PERIODS.find((p) => p.value === l.period)?.per ?? "",
    }))
    .sort((a, b) => b.pct - a.pct);
}

/**
 * Lançamento proposto a partir de uma frase. A categoria vem das regras da pessoa e, sem regra,
 * da palavra-chave da frase (se a categoria existir). Nada é gravado aqui.
 */
export function quickEntryDraft(s: DemoState, text: string, now = new Date()) {
  const p = parseEntry(text, spDate(now));
  const kindOfCategory = p.kind === "entrada" ? "receita" : "despesa";
  const byRule = p.payee ? applyRules(s.categoryRules, { payee: p.payee, categoryId: null as string | null }).categoryId : null;
  const hint = p.categoryHint && s.categories.some((c) => c.id === p.categoryHint && c.kind === kindOfCategory) ? p.categoryHint : null;
  return {
    parsed: p,
    draft: {
      kind: p.kind,
      amount: p.amount,
      payee: p.payee,
      date: p.date,
      categoryId: byRule ?? hint,
      installments: p.installments?.count ?? null,
    },
  };
}

/**
 * Dívidas do Patrimônio com a comparação "quitar ou investir": custo real (juros − inflação do plano)
 * contra o retorno real do cenário central. Sem juros informados ou sem plano, só o que se sabe.
 */
export function debtsView(s: DemoState) {
  const p = s.plan?.inputs;
  return s.assets
    .filter((a) => a.category === "divida")
    .map((a) => {
      const rate = a.rateMonthly ?? null;
      return {
        asset: a,
        comparison: rate !== null && p ? payoffVsInvest(rate, p.inflationAA, p.returns.central) : null,
        months: rate !== null && a.payment ? monthsToPayoff(a.value, rate, a.payment) : null,
        missingRate: rate === null,
      };
    });
}

/** Raio-X do patrimônio. A reserva entra só quando há histórico de gastos para calcular a meta. */
export function xrayView(s: DemoState, now = new Date()) {
  const reserve = emergencyFundView(s, now);
  return wealthXray(s.assets, reserve.monthlyEssential > 0 ? reserve.pct : null, now);
}

/** Lançamentos sem categoria agrupados pela descrição (entradas e saídas à parte), para categorizar de uma vez. Maiores grupos primeiro. */
export function uncategorizedGroups(rows: Transaction[]) {
  const groups = new Map<string, { key: string; payee: string; income: boolean; items: Transaction[]; total: number }>();
  for (const t of rows) {
    const income = t.amount >= 0;
    const key = `${income ? "+" : "-"}${t.payee.trim().toLowerCase()}`;
    const g = groups.get(key) ?? { key, payee: t.payee.trim() || "Sem descrição", income, items: [], total: 0 };
    g.items.push(t);
    g.total += t.amount;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length || Math.abs(b.total) - Math.abs(a.total));
}

/** Resumo do mês fechado para compartilhar: só proporções, nunca valores. */
export function monthCloseShare(s: DemoState, month: string) {
  const c = s.contributions.find((x) => x.month === month);
  const required = planSummary(s)?.required ?? null;
  const ratio = c?.made && c.amount != null && required ? c.amount / required : null;
  const fi = s.plan ? fiProgress(s.plan.inputs, currentWealth(s)).ratio : null;
  return { contributed: !!c?.made, ratio, fi };
}

/** O que o Início destaca: quanto o plano pede neste mês, quanto já foi registrado e o caminho até a independência. */
export function monthHero(s: DemoState, now = new Date()) {
  const plan = planSummary(s);
  if (!plan || !s.plan) return null;
  const month = monthOf(spDate(now));
  const record = s.contributions.find((c) => c.month === month);
  const fi = fiProgress(s.plan.inputs, currentWealth(s));
  return {
    month,
    required: plan.required,
    /** null: o mês ainda não foi registrado; 0: registrado sem aporte. */
    contributed: record ? (record.made ? (record.amount ?? 0) : 0) : null,
    fiRatio: fi.ratio,
  };
}

export type NextStepKey = "plano" | "aporte" | "conta" | "patrimonio" | "fechar" | "revisar";
export type NextStep = {
  key: NextStepKey;
  title: string;
  why: string;
  cta: string;
  to: "/plano" | "/diario" | "/contas" | "/patrimonio" | "/fechamento";
  /** Abre direto o formulário certo na tela de destino. */
  search?: { criar?: true; registrar?: true };
};

/**
 * O único próximo passo que o Início mostra, na ordem que mais move o plano: sem plano não há meta;
 * o aporte do mês é o hábito central; a conta destrava o orçamento; o patrimônio atualiza o progresso;
 * por fim, fechar o mês e revisar o plano quando ele envelhece. Sem pendências, devolve null.
 */
export function nextStep(s: DemoState, now = new Date()): NextStep | null {
  if (!s.plan)
    return { key: "plano", title: "Monte o seu plano", why: "Ele diz quanto guardar por mês para se aposentar sem depender do INSS.", cta: "Montar meu plano", to: "/plano", search: { criar: true } };
  const month = monthOf(spDate(now));
  if (!s.contributions.some((c) => c.month === month))
    return { key: "aporte", title: "Registre o aporte deste mês", why: "É o hábito que mais aproxima você do plano. Mesmo sem aporte, registrar mantém o histórico.", cta: "Registrar aporte", to: "/diario", search: { registrar: true } };
  if (!s.accounts.length)
    return { key: "conta", title: "Cadastre sua conta principal", why: "Com ela, o app mostra para onde vai o dinheiro e quanto sobra para guardar.", cta: "Cadastrar conta", to: "/contas" };
  if (!s.wealthEntries.some((w) => w.month === month))
    return { key: "patrimonio", title: "Atualize o patrimônio do mês", why: "É o que mostra o seu progresso rumo à independência.", cta: "Atualizar patrimônio", to: "/patrimonio", search: { registrar: true } };
  const close = monthCloseSteps(s, now);
  if (close.complete && !close.closed)
    return { key: "fechar", title: "Feche o mês", why: "Está tudo em dia. Fechar registra o mês no seu histórico.", cta: "Fechar o mês", to: "/fechamento" };
  const ageDays = (now.getTime() - new Date(s.plan.updatedAt).getTime()) / DAY_MS;
  if (ageDays > CADENCE_DAYS[s.profile.reviewCadence])
    return { key: "revisar", title: "Revise o seu plano", why: `As premissas não são revistas há ${Math.floor(ageDays)} dias.`, cta: "Revisar plano", to: "/plano" };
  return null;
}

/** Checklist de quem está começando: some quando os três estiverem feitos. */
export function firstSteps(s: DemoState) {
  const items = [
    { key: "aporte", label: "Registrar o primeiro aporte", done: s.contributions.length > 0 },
    { key: "conta", label: "Cadastrar a conta principal", done: s.accounts.length > 0 },
    { key: "patrimonio", label: "Informar o patrimônio", done: s.wealthEntries.length > 0 || s.assets.length > 0 },
  ] as const;
  return items.every((i) => i.done) ? null : items;
}
