import { simulateAll } from "@/lib/calc/retirement";
import { isoWeekKey, levelFromXp, monthOf, spDate, weekStartOf } from "@/lib/gamification/rules";
import { MISSIONS } from "@/content/missions";
import { fiProgress, wealthTimeline } from "@/lib/calc/progress";
import { challengeBySlug } from "@/content/challenges";
import { summarizeAssets } from "@/lib/calc/assets";
import { assetHistory, cumulativeReturn, fiMilestones, growthSummary, periodReturns, snapshotFromAssets } from "@/lib/calc/networth";
import { accountBalances, accountGroup, groupByDay, monthSummary, spendingByCategory, type AccountGroup } from "@/lib/calc/ledger";
import { addDays, nextOccurrence } from "@/lib/calc/recurring";
import { journeyNodes } from "@/lib/journey/journey";
import { UNITS } from "@/content/journey";
import {
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
