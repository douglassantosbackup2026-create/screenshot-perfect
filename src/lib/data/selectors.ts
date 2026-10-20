import { simulateAll } from "@/lib/calc/retirement";
import { isoWeekKey, levelFromXp, monthOf, spDate, weekStartOf } from "@/lib/gamification/rules";
import { MISSIONS } from "@/content/missions";
import { fiProgress, wealthTimeline } from "@/lib/calc/progress";
import { challengeBySlug } from "@/content/challenges";
import { isIncomeSource, isLiability, summarizeAssets } from "@/lib/calc/assets";
import { assetHistory, cumulativeReturn, fiMilestones, growthSummary, periodReturns, snapshotFromAssets } from "@/lib/calc/networth";
import { accountBalances, accountGroup, groupByDay, monthSummary, spendingByCategory, type AccountGroup } from "@/lib/calc/ledger";
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
  valuedByHoldings,
  completedDays,
  dailyMissionDone,
  todayMission,
  type Account,
  type DemoState,
  type Destination,
  type MissingField,
  type ReviewCadence,
  type Transaction,
} from "./demo-store";

/** Missão da semana: segue a ordem e recomeça quando a lista termina. */
export function missionOfWeek(s: DemoState, now = new Date()) {
  const week = isoWeekKey(weekStartOf(spDate(now)));
  const doneThisWeek = s.missionCompletions.find((m) => m.isoWeek === week);
  const idx = (s.missionCompletions.length - (doneThisWeek ? 1 : 0)) % MISSIONS.length;
  return { mission: MISSIONS[idx] ?? MISSIONS[0]!, done: !!doneThisWeek };
}

export function hasMonthRecord(s: DemoState, now = new Date()) {
  const m = monthOf(spDate(now));
  return s.contributions.some((c) => c.month === m);
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

export function hasWealthRecord(s: DemoState, now = new Date()) {
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
export type LedgerRow = Transaction & { accountName: string; categoryName: string | null };

/** Lançamentos do mês, com nomes de conta e categoria, agrupados por dia, mais o resumo e os gastos por categoria. */
export function ledgerMonth(s: DemoState, month: string, accountId: string | null = null) {
  const accounts = new Map(s.accounts.map((a) => [a.id, a.name]));
  const categories = new Map(s.categories.map((c) => [c.id, c.name]));
  const scoped = accountId ? s.transactions.filter((t) => t.accountId === accountId) : s.transactions;
  const rows: LedgerRow[] = scoped
    .filter((t) => t.date.slice(0, 7) === month.slice(0, 7))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .map((t) => ({ ...t, accountName: accounts.get(t.accountId) ?? "Conta removida", categoryName: t.categoryId ? (categories.get(t.categoryId) ?? null) : null }));
  return {
    days: groupByDay(rows),
    summary: monthSummary(scoped, month),
    byCategory: spendingByCategory(scoped, month).map((c) => ({ ...c, name: c.categoryId ? (categories.get(c.categoryId) ?? "Sem categoria") : "Sem categoria" })),
    uncategorized: rows.filter((t) => !t.transferId && !t.categoryId).length,
  };
}

export const ACCOUNT_GROUP_LABEL: Record<AccountGroup, string> = {
  dia_a_dia: "Dia a dia",
  investimentos: "Previdência e investimentos",
  dividas: "Cartões e dívidas",
};

/** Contas com saldo, por grupo. Em cartões e dívidas, saldo negativo é o que se deve. */
export function accountsOverview(s: DemoState) {
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
  const today = spDate(now);
  const end = addDays(shiftMonth(month, 1), -1);
  const launched = new Set(s.transactions.flatMap((t) => (t.recurringId && t.occurrenceDate ? [`${t.recurringId}|${t.occurrenceDate}`] : [])));
  const items = s.recurring
    .filter((r) => r.active && r.amount < 0)
    .flatMap((r) =>
      occurrencesUntil(r, end)
        .filter((o) => o.date.slice(0, 7) === month.slice(0, 7))
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
      out.push({ key: "patrimonio-do-mes", message: "O patrimônio deste mês ainda não foi registrado.", to: "/evolucao" });
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
