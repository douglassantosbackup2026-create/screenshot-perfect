// Regras que alteram uma cópia do estado dentro das operações: XP, sequências, recorrências, histórico.
// Espelham as funções SQL (o banco é a fonte da verdade no modo nuvem).
import { type BreakdownItem } from "@/lib/calc/networth";
import { accountBalances } from "@/lib/calc/ledger";
import { dueOccurrences } from "@/lib/calc/recurring";
import { normalize } from "@/lib/calc/categorize";
import { addMonths, awardXp, challengeProgress, computeDayStreak, levelFromXp, computeStreak, eligibleAchievements, hasFullQuarter, monthOf, spDate, weekStartOf, XP, type AchievementCode } from "@/lib/gamification/rules";
import { challengeBySlug } from "@/content/challenges";
import { UNITS } from "@/content/journey";
import { unitProgress, type DailyKind } from "@/lib/journey/journey";
import { Destination, Transaction, DemoState } from "./model";
import { dayOf, challengeInputs, holdingsValue, valuedByHoldings, completedDays, isDate } from "./derived";

let idSeq = 0;
/** Ids no formato do banco (uuid), para o que é criado aqui poder ser gravado com o mesmo id. */
export const newId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  const hex = (Date.now().toString(16) + (idSeq++).toString(16).padStart(8, "0") + Math.random().toString(16).slice(2)).padEnd(32, "0").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};

export function addDaysIso(day: string, n: number) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Conclui desafios que atingiram a meta. Devolve o XP concedido. */
export function settleChallenges(s: DemoState, now: Date): number {
  const today = spDate(now);
  const inputs = challengeInputs(s);
  let xp = 0;
  s.challenges = s.challenges.map((c) => {
    const def = challengeBySlug(c.slug);
    if (c.completedAt || !def) return c;
    const p = challengeProgress(def, dayOf(c.startedAt), inputs, today);
    if (!p.completed) return c;
    const a = awardXp(s.xpEvents, "challenge_completed", `C:${c.slug}:${c.startedAt}`, now.toISOString());
    s.xpEvents = a.events;
    xp += a.awarded;
    return { ...c, completedAt: now.toISOString() };
  });
  return xp;
}

/** Recalcula sequências, nível, conquistas e XP total (espelho de _refresh_progress). */
export function refresh(s: DemoState, now: Date): { fresh: AchievementCode[]; xp: number } {
  const today = spDate(now);
  const xp = settleChallenges(s, now);
  const { streak, weeks } = computeStreak(s.weeks, today);
  s.weeks = weeks;
  const day = computeDayStreak(s.days, today);
  const contribMonths = s.xpEvents.filter((e) => e.action === "contribution_logged").map((e) => e.periodKey.slice(2) + "-01");
  const reviews = s.snapshots.filter((x) => x.reason !== "created").map((x) => dayOf(x.createdAt));
  const eligible = eligibleAchievements({
    hasPlan: !!s.plan,
    contributionMonthKeys: contribMonths,
    emergencyFundReady: s.profile.emergencyFundReady,
    hasLifeEvent: s.snapshots.some((x) => x.reason === "life_event"),
    programCompleted: !!s.program.completedAt,
    hasAnnualReview: s.xpEvents.some((e) => e.action === "annual_review"),
    hasWealthEntry: s.wealthEntries.length > 0,
    hasGoal: s.goals.length > 0,
    hasCompletedGoal: s.goals.some((g) => g.completedAt),
    hasFullQuarter: hasFullQuarter(
      s.wealthEntries.map((w) => w.month),
      reviews,
    ),
    hasCompletedChallenge: s.challenges.some((c) => c.completedAt),
    hasCompletedFirstUnit: unitProgress(UNITS[0]!, completedDays(s)).complete,
    hasImportedStatement: s.transactions.some((t) => t.source === "importado"),
    hasPlannedBudget: Object.values(s.budget.assigned).some((m) => Object.values(m).some((v) => v > 0)),
    hasInvestmentTrade: s.trades.length > 0,
    hasAllocationTargets: Object.keys(s.allocationTargets).length > 0,
    hasClosedMonth: s.xpEvents.some((e) => e.action === "month_closed"),
  });
  const have = new Set(s.achievements.map((a) => a.code));
  const fresh = eligible.filter((c) => !have.has(c));
  s.achievements = [...s.achievements, ...fresh.map((code) => ({ code, at: now.toISOString() }))];
  const totalXp = s.xpEvents.reduce((a, e) => a + e.xp, 0);
  s.stats = {
    totalXp,
    level: levelFromXp(totalXp).level,
    weekStreak: streak,
    bestWeekStreak: Math.max(s.stats.bestWeekStreak, streak),
    dayStreak: day.streak,
    bestDayStreak: Math.max(s.stats.bestDayStreak, day.streak),
  };
  return { fresh, xp };
}

/** Marca hoje como dia ativo e a semana como ativa (espelho de _mark_week_active). */
export function markActive(s: DemoState, now: Date) {
  const today = spDate(now);
  const ws = weekStartOf(today);
  s.weeks = [...s.weeks.filter((w) => w.weekStart !== ws), { weekStart: ws, status: "ativa" }];
  if (!s.days.includes(today)) s.days = [...s.days, today];
}

/** Guarda o valor do item no histórico do mês; no mesmo mês, o novo valor substitui o anterior. */
export function recordValuation(s: DemoState, assetId: string, value: number, now: Date) {
  const month = monthOf(spDate(now));
  s.assetValuations = [
    ...s.assetValuations.filter((v) => !(v.assetId === assetId && v.month === month)),
    { assetId, month, value, at: now.toISOString() },
  ];
}

/** XP por planejar um mês no orçamento: o atual ou um à frente, uma vez por mês planejado (espelho de _budget_award). */
export function awardBudgetPlanned(s: DemoState, now: Date, month: string): number {
  if (month < monthOf(spDate(now))) return 0;
  const a = awardXp(s.xpEvents, "budget_planned", "M:" + month.slice(0, 7), now.toISOString());
  s.xpEvents = a.events;
  markActive(s, now);
  return a.awarded;
}

/** Leva o saldo das contas ligadas para o valor dos itens do Patrimônio (com histórico), a cada gravação. */
export function withLinkedAssets(s: DemoState, now: Date): DemoState {
  const linked = s.accounts.filter((a) => a.assetId);
  if (!linked.length) return s;
  const balances = accountBalances(s.accounts, s.transactions);
  let changed = false;
  const assets = s.assets.map((a) => {
    const acc = linked.find((x) => x.assetId === a.id);
    if (!acc || valuedByHoldings(s, a.id)) return a;
    const value = Math.max(balances[acc.id] ?? 0, 0) / 100;
    if (value === a.value) return a;
    changed = true;
    return { ...a, value, updatedAt: now.toISOString() };
  });
  if (!changed) return s;
  const next = { ...s, assets };
  for (const a of assets) if (s.assets.find((x) => x.id === a.id)?.value !== a.value) recordValuation(next, a.id, a.value, now);
  return next;
}

/** Com posições operadas, o valor do item do Patrimônio passa a ser a soma delas, e entra no histórico. */
export function syncAssetFromHoldings(s: DemoState, assetId: string, now: Date) {
  const asset = s.assets.find((a) => a.id === assetId);
  if (!asset || !valuedByHoldings(s, assetId)) return;
  const value = holdingsValue(s, assetId) / 100;
  if (value === asset.value) return;
  s.assets = s.assets.map((a) => (a.id === assetId ? { ...a, value, updatedAt: now.toISOString() } : a));
  recordValuation(s, assetId, value, now);
}

/** Confere conta, data, valor e favorecido de um lançamento. */
export function validTx(s: DemoState, t: { accountId: string; date: string; amount: number; payee: string }) {
  if (!s.accounts.some((a) => a.id === t.accountId)) throw new Error("Conta não encontrada.");
  if (!isDate(t.date)) throw new Error("Data inválida.");
  if (!(Number.isInteger(t.amount) && t.amount !== 0)) throw new Error("Informe um valor diferente de zero.");
  const payee = t.payee.trim();
  if (!payee) throw new Error("Informe a descrição.");
  return { accountId: t.accountId, date: t.date, amount: t.amount, payee: payee.slice(0, 120) };
}

/** Cria "favorecido igual a … → categoria", se ainda não houver uma regra igual. */
export function rememberRule(s: DemoState, payee: string, categoryId: string | null) {
  if (!categoryId) return;
  const existing = s.categoryRules.find((r) => r.op === "igual" && normalize(r.value) === normalize(payee));
  if (existing) existing.categoryId = categoryId;
  else s.categoryRules.push({ id: newId(), op: "igual", value: payee, categoryId, renameTo: null });
}

/** Grava o registro do mês no Diário (espelho de log_contribution) e devolve o XP e o id. */
export function recordContribution(
  s: DemoState,
  now: Date,
  input: { month: string; made: boolean; amount?: number | null; destination?: Destination | null; note?: string | null },
): { xp: number; id: string } {
  const current = monthOf(spDate(now));
  const month = monthOf(input.month);
  if (month > current) throw new Error("Não é possível registrar um mês futuro.");
  const id = newId();
  s.contributions.push({
    id,
    month,
    made: input.made,
    amount: input.made ? (input.amount ?? null) : null,
    destination: input.destination ?? null,
    note: input.note ?? null,
    createdAt: now.toISOString(),
  });
  // XP pelo hábito de registrar o mês (inclusive "não aportei"), nunca pelo valor aportado.
  let xp = 0;
  if (month >= addMonths(current, -1)) {
    const a = awardXp(s.xpEvents, "contribution_logged", "M:" + month.slice(0, 7), now.toISOString());
    s.xpEvents = a.events;
    xp = a.awarded;
  }
  markActive(s, now);
  return { xp, id };
}

export function newTransaction(t: Pick<Transaction, "accountId" | "date" | "amount" | "payee"> & Partial<Transaction>, now: Date): Transaction {
  return {
    categoryId: null,
    note: null,
    transferId: null,
    importedId: null,
    source: "manual",
    recurringId: null,
    occurrenceDate: null,
    contributionId: null,
    ...t,
    id: newId(),
    createdAt: now.toISOString(),
  };
}

/** Lança as ocorrências recorrentes vencidas até hoje (espelho de materialize_recurring). Devolve quantas lançou. */
export function materializeRecurring(s: DemoState, now: Date): number {
  const today = spDate(now);
  let added = 0;
  for (const r of s.recurring) {
    if (!r.active || !s.accounts.some((a) => a.id === r.accountId)) continue;
    const generated = new Set(s.transactions.flatMap((t) => (t.recurringId === r.id && t.occurrenceDate ? [t.occurrenceDate] : [])));
    for (const o of dueOccurrences(r, generated, today)) {
      const t = newTransaction(
        { accountId: r.accountId, date: o.date, amount: r.amount, payee: r.payee, categoryId: r.categoryId, note: r.note, source: "recorrente", recurringId: r.id, occurrenceDate: o.occurrenceDate },
        now,
      );
      s.transactions.push(t);
      added++;
    }
  }
  return added;
}

/** Grava o patrimônio de um mês (espelho de log_wealth): substitui o registro do mesmo mês e devolve o XP. */
export function recordWealth(
  s: DemoState,
  now: Date,
  input: { month: string; total: number; previdencia?: number | null; note?: string | null; breakdown: BreakdownItem[] | null },
): number {
  const current = monthOf(spDate(now));
  const month = monthOf(input.month);
  if (month > current) throw new Error("Não é possível registrar um mês futuro.");
  if (!(input.total >= 0)) throw new Error("Informe um valor igual ou maior que zero.");
  s.wealthEntries = [
    ...s.wealthEntries.filter((w) => w.month !== month),
    {
      id: newId(),
      month,
      total: input.total,
      previdencia: input.previdencia ?? null,
      note: input.note ?? null,
      breakdown: input.breakdown,
      createdAt: now.toISOString(),
    },
  ];
  // XP pelo hábito de registrar neste mês, não pelo valor nem pelo mês registrado.
  const a = awardXp(s.xpEvents, "wealth_logged", "M:" + current.slice(0, 7), now.toISOString());
  s.xpEvents = a.events;
  markActive(s, now);
  return a.awarded;
}

/** Registra a missão do dia (uma por dia) e devolve o XP. */
export function settleDailyMission(s: DemoState, now: Date, kind: DailyKind): number {
  const today = spDate(now);
  if (s.journey.dailyMissions.some((m) => m.day === today)) return 0;
  s.journey.dailyMissions = [...s.journey.dailyMissions, { day: today, kind, at: now.toISOString() }];
  const a = awardXp(s.xpEvents, "daily_mission", "D:" + today, now.toISOString());
  s.xpEvents = a.events;
  return a.awarded;
}
