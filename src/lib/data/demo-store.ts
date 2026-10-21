// Camada de dados em MODO DEMONSTRAÇÃO (sem login): guarda o estado só neste aparelho.
// Na etapa de login, as mesmas operações passam a chamar as RPCs do Supabase (§6.1).
import { useRef, useSyncExternalStore } from "react";
import { ENGINE_VERSION, simulateAll, type PlanInputs } from "@/lib/calc/retirement";
import { validateAsset, type AssetCategory } from "@/lib/calc/assets";
import { snapshotFromAssets } from "@/lib/calc/networth";
import { isSavingsAccount, type AccountKind } from "@/lib/calc/ledger";
import { budgetActivity, RETIREMENT_ENVELOPE, shiftMonth, templateAmount, validateTemplate, type BudgetTemplate } from "@/lib/calc/budget";
import { validateRule } from "@/lib/calc/recurring";
import { applyRules, normalize, type CategoryRule, type RuleOp } from "@/lib/calc/categorize";
import { dedupe, type ImportedTx } from "@/lib/calc/import";
import { holdsPositions, positionFromTrades, validateTargets, type AssetClass, type TradeType } from "@/lib/calc/portfolio";
import { addMonths, awardXp, goalCreatedPeriodKey, isoWeekKey, monthOf, quarterKey, spDate, weekStartOf, XP, type WeekRecord, type XpEvent } from "@/lib/gamification/rules";
import { PROGRAM } from "@/content/program";
import { CHALLENGES, challengeBySlug } from "@/content/challenges";
import { gradePlacement, gradeReview, isLessonUnlocked, missionAccepts, canTakePlacement, type DailyKind } from "@/lib/journey/journey";
import { Destination, SnapshotReason, Profile, Contribution, WealthEntry, GoalKind, Asset, AssetValuation, Account, CategoryKind, Category, Transaction, RecurringRule, Holding, PortfolioTrade, Budget, DemoState, MAX_ACTIVE_CHALLENGES, ActionResult, DEFAULT_CATEGORIES, EMPTY_STATS } from "./model";
import { dayOf, monthCloseSteps, linkedAccountOf, valuedByHoldings, BUDGET_MONTHS_AHEAD, budgetTxInputs, budgetEnvelopeIds, budgetMonths, activeChallenges, planAgeDays, completedDays, todayMission, isDate } from "./derived";
import { newId, addDaysIso, refresh, markActive, recordValuation, awardBudgetPlanned, withLinkedAssets, syncAssetFromHoldings, validTx, rememberRule, recordContribution, newTransaction, materializeRecurring, recordWealth, settleDailyMission } from "./state-rules";

// O resto do app importa tudo daqui: tipos e leituras continuam saindo deste arquivo.
export * from "./model";
export * from "./derived";

const KEY = "pi_demo_state_v1";

/** Pessoa de exemplo "Ana", com os dados do caso A da seção 7.4. */
export function makeSeed(now = new Date()): DemoState {
  const today = spDate(now);
  const month = monthOf(today);
  const iso = now.toISOString();
  const inputs: PlanInputs = {
    currentAge: 30,
    retirementAge: 60,
    horizonAge: 95,
    initialWealth: 10000,
    monthlyContribution: 1000,
    desiredMonthlyIncome: 8000,
    inssEstimate: 4500,
    returns: { conservador: 0.02, central: 0.04, otimista: 0.06 },
    inflationAA: 0.04,
    costsAA: 0,
  };
  const contributions: Contribution[] = [
    { m: -4, made: true },
    { m: -3, made: false },
    { m: -2, made: true },
    { m: -1, made: true },
  ].map(({ m, made }) => ({
    id: newId(),
    month: addMonths(month, m),
    made,
    amount: made ? 1000 : null,
    destination: made ? ("previdencia" as const) : null,
    note: null,
    createdAt: iso,
  }));
  const lessonCompletions: Record<number, string> = {};
  for (let d = 1; d <= 14; d++) lessonCompletions[d] = new Date(now.getTime() - (15 - d) * 86400000).toISOString();
  const xpEvents: XpEvent[] = [];
  for (let d = 1; d <= 14; d++) xpEvents.push({ action: "lesson_completed", periodKey: `L:${d}`, xp: XP.lesson_completed, at: iso });
  xpEvents.push({ action: "first_plan_created", periodKey: "ONCE", xp: 100, at: iso });
  // Só o mês anterior ainda gera XP em tempo real; os mais antigos foram "registrados em dia" na época.
  for (const c of contributions)
    xpEvents.push({ action: "contribution_logged", periodKey: "M:" + c.month.slice(0, 7), xp: XP.contribution_logged, at: iso });
  const thisWeek = weekStartOf(today);
  const weeks: WeekRecord[] = [1, 2, 3].map((k) => ({
    weekStart: weekStartOf(addDaysIso(thisWeek, -7 * k)),
    status: "ativa" as const,
  }));
  // Seis meses de patrimônio registrado, um por mês; o mês atual bate com o plano.
  const wealthEntries: WealthEntry[] = [6000, 7100, 7200, 8300, 9400, 10000].map((total, k) => {
    const m = addMonths(month, k - 5);
    return {
      id: newId(),
      month: m,
      total,
      previdencia: total,
      note: null,
      breakdown: null,
      createdAt: k === 5 ? iso : `${m.slice(0, 8)}15T12:00:00.000Z`,
    };
  });
  for (const w of wealthEntries.slice(0, -1))
    xpEvents.push({ action: "wealth_logged", periodKey: "M:" + w.month.slice(0, 7), xp: 30, at: w.createdAt });
  xpEvents.push({ action: "wealth_logged", periodKey: "M:" + month.slice(0, 7), xp: 30, at: iso });
  const goalId = newId();
  xpEvents.push({ action: "goal_created", periodKey: `G:${month.slice(0, 7)}:${goalId}`, xp: 20, at: iso });
  const days = Object.values(lessonCompletions).map((d) => spDate(new Date(d)));
  // Patrimônio item a item: os R$ 10 mil para a aposentadoria batem com o plano; a reserva fica de fora.
  const assets: Asset[] = [
    { name: "PGBL da corretora", category: "pgbl" as const, value: 8000, forRetirement: true },
    { name: "Tesouro IPCA+", category: "investimentos" as const, value: 2000, forRetirement: true },
    { name: "Reserva no CDB de liquidez diária", category: "reserva" as const, value: 6000, forRetirement: false },
  ].map((a) => ({ ...a, id: newId(), note: null, source: "manual" as const, updatedAt: iso }));
  // Histórico dos itens nos últimos meses; a soma do que é para a aposentadoria bate com os registros mensais.
  const history: number[][] = [
    [6000, 7100, 7200, 7300, 7900, 8000],
    [NaN, NaN, NaN, 1000, 1500, 2000],
    [5000, NaN, NaN, NaN, NaN, 6000],
  ];
  const assetValuations: AssetValuation[] = assets.flatMap((a, i) =>
    history[i]!.flatMap((value, k) => {
      const m = addMonths(month, k - 5);
      return Number.isNaN(value) ? [] : [{ assetId: a.id, month: m, value, at: k === 5 ? iso : `${m.slice(0, 8)}15T12:00:00.000Z` }];
    }),
  );
  // Livro-caixa: conta corrente, cartão e previdência, com o mês passado e o atual até hoje.
  const accounts: Account[] = [
    { id: newId(), name: "Conta corrente", kind: "corrente", openingBalance: 350000, createdAt: iso, assetId: null },
    { id: newId(), name: "Cartão de crédito", kind: "cartao", openingBalance: 0, createdAt: iso, assetId: null },
    { id: newId(), name: "PGBL da corretora", kind: "previdencia", openingBalance: 0, createdAt: iso, assetId: null },
  ];
  const [cc, card, prev] = accounts.map((a) => a.id) as [string, string, string];
  const prevMonth = addMonths(month, -1);
  const day = (m: string, d: number) => `${m.slice(0, 8)}${String(d).padStart(2, "0")}`;
  const tx = (accountId: string, date: string, amount: number, payee: string, categoryId: string | null): Transaction => ({
    id: newId(), accountId, date, amount, payee, categoryId, note: null, transferId: null, importedId: null,
    source: "manual", recurringId: null, occurrenceDate: null, contributionId: null, createdAt: iso,
  });
  const transactions: Transaction[] = [
    tx(cc, day(prevMonth, 5), 800000, "Cliente Alfa", "cat-renda"),
    tx(card, day(prevMonth, 8), -64230, "Supermercado", "cat-mercado"),
    tx(card, day(prevMonth, 14), -8900, "Uber", "cat-transporte"),
    tx(card, day(prevMonth, 21), -12750, "Restaurante", "cat-restaurantes"),
    tx(cc, day(prevMonth, 25), -42000, "Imposto do MEI e DAS", "cat-impostos"),
    tx(cc, day(month, 5), 800000, "Cliente Alfa", "cat-renda"),
    tx(card, day(month, 7), -58110, "Supermercado", "cat-mercado"),
    tx(card, day(month, 12), -6400, "Uber", "cat-transporte"),
  ].filter((t) => t.date <= today);
  // O aporte do mês passado saiu da conta corrente para a previdência.
  const contribution = contributions[contributions.length - 1]!;
  const out = tx(cc, day(prevMonth, 10), -100000, "Transferência para PGBL da corretora", null);
  const inn = tx(prev, out.date, 100000, "Transferência da Conta corrente", null);
  out.transferId = inn.id;
  inn.transferId = out.id;
  out.contributionId = contribution.id;
  transactions.push(out, inn);
  const recurring: RecurringRule[] = [
    { payee: "Aluguel", amount: -200000, categoryId: "cat-moradia", accountId: cc, d: 10, weekend: "antes" as const },
    { payee: "Streaming", amount: -5590, categoryId: "cat-assinaturas", accountId: card, d: 15, weekend: "manter" as const },
  ].map(({ d, ...r }) => ({ ...r, id: newId(), note: null, active: true, startDate: day(prevMonth, d), frequency: "mensal" as const, interval: 1, endDate: null }));
  const categoryRules: CategoryRule[] = [
    { id: newId(), op: "contem", value: "uber", categoryId: "cat-transporte", renameTo: "Uber" },
    { id: newId(), op: "contem", value: "supermercado", categoryId: "cat-mercado", renameTo: null },
  ];
  // Orçamento: o mês passado e o atual distribuídos; a viagem é um cofrinho com prazo.
  const travel: Category = { id: "cat-viagem", name: "Viagem", kind: "despesa" };
  const envelopes: Record<string, number> = {
    "cat-moradia": 200000,
    "cat-mercado": 70000,
    "cat-transporte": 20000,
    "cat-restaurantes": 30000,
    "cat-assinaturas": 6000,
    "cat-impostos": 42000,
    "cat-lazer": 20000,
    [travel.id]: 60000,
    [RETIREMENT_ENVELOPE]: 100000,
  };
  const budget: Budget = {
    assigned: { [prevMonth]: { ...envelopes }, [month]: { ...envelopes } },
    templates: [
      { envelopeId: "cat-moradia", kind: "fixo", amount: 200000, target: null, deadline: null, percent: null },
      { envelopeId: "cat-mercado", kind: "fixo", amount: 70000, target: null, deadline: null, percent: null },
      { envelopeId: RETIREMENT_ENVELOPE, kind: "fixo", amount: 100000, target: null, deadline: null, percent: null },
      { envelopeId: travel.id, kind: "ate_data", amount: null, target: 600000, deadline: addMonths(month, 8), percent: null },
    ],
  };
  // Investimentos: o Tesouro IPCA+ do Patrimônio tem duas posições que somam os mesmos R$ 2 mil.
  const tesouro = assets[1]!;
  const holdings: Holding[] = [
    { id: newId(), assetId: tesouro.id, name: "Tesouro IPCA+ 2035", assetClass: "renda_fixa", price: 250000, priceUpdatedAt: iso },
    { id: newId(), assetId: tesouro.id, name: "BOVA11", assetClass: "acoes", price: 12500, priceUpdatedAt: iso },
  ];
  const [ipca, bova] = holdings.map((h) => h.id) as [string, string];
  const trade = (holdingId: string, date: string, type: TradeType, quantity: number, unitPrice: number): PortfolioTrade => ({
    id: newId(), holdingId, date, type, quantity, unitPrice, fees: 0,
  });
  const trades: PortfolioTrade[] = [
    trade(ipca, day(addMonths(month, -2), 10), "compra", 0.4, 240000),
    trade(ipca, day(prevMonth, 10), "compra", 0.2, 245000),
    trade(bova, day(prevMonth, 12), "compra", 5, 11000),
    trade(bova, day(prevMonth, 25), "provento", 0, 250),
    trade(bova, day(prevMonth, 28), "venda", 1, 12000),
  ];
  const s: DemoState = {
    version: 8,
    profile: {
      displayName: "Ana",
      birthYear: Number(today.slice(0, 4)) - 30,
      workType: "pj",
      hasOverdueDebt: false,
      emergencyFundReady: false,
      monthlyReminder: true,
      reminderDay: 5,
      weeklyReminder: true,
      analyticsConsent: false,
      onboardingCompletedAt: iso,
      goalRetirementAge: 60,
      goalIncome: 8000,
      hideValues: true,
      objective: "entender",
      reviewCadence: "trimestral",
      missingFields: [],
    },
    plan: { id: newId(), createdAt: iso, updatedAt: iso, inputs },
    snapshots: [
      {
        id: newId(),
        reason: "created",
        createdAt: iso,
        engineVersion: ENGINE_VERSION,
        inputs,
        requiredCentralSemInss: simulateAll(inputs).semInss.central.requiredMonthlyContribution,
      },
    ],
    contributions,
    program: { currentDay: 15, startedAt: iso, completedAt: null },
    lessonCompletions,
    answers: {},
    missionCompletions: [],
    xpEvents,
    weeks,
    achievements: [],
    wealthEntries,
    goals: [
      {
        id: goalId,
        title: "Chegar a R$ 20 mil guardados para a aposentadoria",
        kind: "valor",
        target: 20000,
        deadline: addMonths(month, 12),
        createdAt: iso,
        completedAt: null,
      },
    ],
    challenges: [{ slug: CHALLENGES[0]!.slug, startedAt: new Date(now.getTime() - 3 * 86400000).toISOString(), completedAt: null }],
    assets,
    assetValuations,
    accounts,
    categories: [...DEFAULT_CATEGORIES, travel],
    transactions,
    recurring,
    categoryRules,
    budget,
    holdings,
    trades,
    allocationTargets: { previdencia: 60, renda_fixa: 25, acoes: 15 },
    journey: { testedOutUnits: [], dailyMissions: [] },
    days,
    stats: { ...EMPTY_STATS },
  };
  materializeRecurring(s, now);
  refresh(s, now);
  s.achievements = s.achievements.map((a) => ({ ...a }));
  return s;
}

/** Completa um estado salvo por versões anteriores com os campos novos. */
function migrate(raw: DemoState): DemoState {
  if (raw.version === 8) return raw;
  const assets = raw.assets ?? [];
  return {
    ...raw,
    version: 8,
    holdings: raw.holdings ?? [],
    trades: raw.trades ?? [],
    allocationTargets: raw.allocationTargets ?? {},
    budget: raw.budget ?? { assigned: {}, templates: [] },
    accounts: (raw.accounts ?? []).map((a) => ({ ...a, assetId: a.assetId ?? null })),
    categories: raw.categories ?? [...DEFAULT_CATEGORIES],
    transactions: raw.transactions ?? [],
    recurring: raw.recurring ?? [],
    categoryRules: raw.categoryRules ?? [],
    journey: raw.journey ?? { testedOutUnits: [], dailyMissions: [] },
    profile: {
      ...raw.profile,
      hideValues: raw.profile.hideValues ?? true,
      objective: raw.profile.objective ?? null,
      reviewCadence: raw.profile.reviewCadence ?? "trimestral",
      missingFields: raw.profile.missingFields ?? [],
    },
    assets,
    // Sem histórico salvo: o valor atual de cada item vira o primeiro ponto, no mês da última atualização.
    assetValuations:
      raw.assetValuations ?? assets.map((a) => ({ assetId: a.id, month: monthOf(dayOf(a.updatedAt)), value: a.value, at: a.updatedAt })),
    wealthEntries: (raw.wealthEntries ?? []).map((w) => ({ ...w, breakdown: w.breakdown ?? null })),
    goals: raw.goals ?? [],
    challenges: raw.challenges ?? [],
    days: raw.days ?? [],
    stats: { ...EMPTY_STATS, ...raw.stats },
  };
}

/** Estado de quem está começando agora: sem plano, sem registros, com as categorias padrão. */
export function emptyState(now = new Date()): DemoState {
  const s = makeSeed(now);
  return {
    ...s,
    profile: {
      ...s.profile,
      displayName: "",
      onboardingCompletedAt: null,
      birthYear: null,
      workType: null,
      hasOverdueDebt: null,
      goalRetirementAge: null,
      goalIncome: null,
      objective: null,
      missingFields: [],
    },
    assets: [],
    assetValuations: [],
    accounts: [],
    categories: [...DEFAULT_CATEGORIES],
    transactions: [],
    recurring: [],
    categoryRules: [],
    budget: { assigned: {}, templates: [] },
    holdings: [],
    trades: [],
    allocationTargets: {},
    journey: { testedOutUnits: [], dailyMissions: [] },
    plan: null,
    snapshots: [],
    contributions: [],
    program: { currentDay: 1, startedAt: now.toISOString(), completedAt: null },
    lessonCompletions: {},
    answers: {},
    missionCompletions: [],
    xpEvents: [],
    weeks: [],
    achievements: [],
    wealthEntries: [],
    goals: [],
    challenges: [],
    days: [],
    stats: { ...EMPTY_STATS },
  };
}

// ---------- Store ----------
// Dois modos: "demo" guarda o estado neste aparelho (localStorage); "cloud" (com login) mantém o estado só em
// memória e entrega cada operação ao sincronizador (src/lib/data/cloud.ts), que grava no banco e recarrega de lá.
let state: DemoState | null = null;
const listeners = new Set<() => void>();
let backend: "demo" | "cloud" = "demo";

export type SyncHandler = (op: string, args: unknown[], prev: DemoState, next: DemoState) => void;
let syncHandler: SyncHandler | null = null;

function load(): DemoState {
  if (state) return state;
  if (backend === "cloud") return (state = emptyState());
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    state = raw ? migrate(JSON.parse(raw) as DemoState) : makeSeed();
  } catch {
    state = makeSeed();
  }
  return state;
}
function commit(raw: DemoState) {
  const next = withLinkedAssets(raw, new Date());
  state = next;
  if (backend === "demo") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* armazenamento indisponível */
    }
  }
  listeners.forEach((l) => l());
}

/** Liga o modo nuvem (estado vazio até o sincronizador carregar do banco) ou volta ao modo demonstração. */
export function useBackend(mode: "demo" | "cloud", handler: SyncHandler | null = null) {
  if (mode === backend && handler === syncHandler) return;
  backend = mode;
  syncHandler = handler;
  state = null;
  listeners.forEach((l) => l());
}
export const currentBackend = () => backend;

/** Troca o estado inteiro pelo que veio do banco (modo nuvem). */
export function replaceState(next: DemoState) {
  state = next;
  listeners.forEach((l) => l());
}
export const getState = (): DemoState => load();
function mutate(fn: (s: DemoState, now: Date) => number): ActionResult {
  const now = new Date();
  const s: DemoState = structuredClone(load());
  const xp = fn(s, now);
  const r = refresh(s, now);
  commit(s);
  return {
    xpAwarded: xp + r.xp,
    newAchievements: r.fresh,
    totalXp: s.stats.totalXp,
    level: s.stats.level,
    weekStreak: s.stats.weekStreak,
    dayStreak: s.stats.dayStreak,
  };
}

let serverSeed: DemoState | null = null;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const serverSnapshot = () => (serverSeed ??= makeSeed());

export function useDemo(): DemoState {
  return useSyncExternalStore(subscribe, load, serverSnapshot);
}

/**
 * Lê só uma parte do estado: a tela re-renderiza apenas quando essa parte muda (compare valores simples ou
 * referências estáveis do estado, como `s.profile`). O seletor roda uma vez por versão do estado.
 */
export function useDemoSelect<T>(select: (s: DemoState) => T): T {
  const last = useRef<{ state: DemoState; value: T } | null>(null);
  const read = (state: DemoState) => {
    if (last.current?.state !== state) last.current = { state, value: select(state) };
    return last.current.value;
  };
  return useSyncExternalStore(
    subscribe,
    () => read(load()),
    () => read(serverSnapshot()),
  );
}

// ---------- Operações (mesma forma das RPCs) ----------
const rawDemo = {
  reset() {
    commit(makeSeed());
  },
  startFresh() {
    commit(emptyState());
  },
  updateProfile(patch: Partial<Profile>) {
    const s = structuredClone(load());
    s.profile = { ...s.profile, ...patch };
    commit(s);
  },
  setEmergencyFund(ready: boolean): ActionResult {
    return mutate((s) => {
      s.profile.emergencyFundReady = ready;
      return 0;
    });
  },
  answerQuestion(day: number, position: number, selected: string, correctOption: string) {
    let isCorrect = false;
    const r = mutate((s, now) => {
      const key = `${day}-${position}`;
      isCorrect = selected === correctOption;
      if (s.answers[key]) return 0; // só a primeira resposta conta
      s.answers[key] = { selected, correct: isCorrect };
      if (!isCorrect) return 0;
      const a = awardXp(s.xpEvents, "quiz_correct", `Q:${key}`, now.toISOString());
      s.xpEvents = a.events;
      return a.awarded;
    });
    return { ...r, isCorrect };
  },
  completeLesson(day: number): ActionResult & { programCompleted: boolean } {
    let done = false;
    const r = mutate((s, now) => {
      if (!isLessonUnlocked(day, completedDays(s), s.journey.testedOutUnits)) throw new Error("Esta lição ainda não abriu.");
      // A missão do dia é avaliada antes da conclusão, com a trilha como estava ao abrir o app.
      const mission = todayMission(s, now);
      let xp = 0;
      if (!s.lessonCompletions[day]) {
        s.lessonCompletions[day] = now.toISOString();
        // Progresso livre: XP uma vez por lição, sem limite por dia.
        const a = awardXp(s.xpEvents, "lesson_completed", "L:" + day, now.toISOString());
        s.xpEvents = a.events;
        xp += a.awarded;
        if (missionAccepts(mission, "learn")) xp += settleDailyMission(s, now, "learn");
      }
      // currentDay fica só por compatibilidade com dados antigos; quem abre lições é a trilha.
      s.program.currentDay = Math.max(s.program.currentDay, day + 1);
      if (Object.keys(s.lessonCompletions).length >= PROGRAM.totalDays) {
        s.program.completedAt ??= now.toISOString();
        const a = awardXp(s.xpEvents, "program_completed", "P:" + PROGRAM.slug, now.toISOString());
        s.xpEvents = a.events;
        xp += a.awarded;
        done = true;
      }
      markActive(s, now);
      return xp;
    });
    return { ...r, programCompleted: done };
  },
  /** Teste de nivelamento: acertando todas, a unidade fica liberada. Não dá XP pelas lições puladas. */
  submitPlacement(unit: number, answers: Record<string, string>): ActionResult & { passed: boolean; correct: number; total: number } {
    let g = { correct: 0, total: 0, passed: false };
    const r = mutate((s) => {
      if (!canTakePlacement(unit, completedDays(s), s.journey.testedOutUnits)) throw new Error("Este teste não está disponível agora.");
      g = gradePlacement(unit, answers);
      if (g.passed) s.journey.testedOutUnits = [...s.journey.testedOutUnits, unit];
      return 0;
    });
    return { ...r, ...g };
  },
  /** Conclui a missão do dia, se a atividade for a de hoje. Quiz e revisão exigem acertar 2 de 3. */
  completeDailyMission(kind: DailyKind, answers?: Record<string, string>): ActionResult {
    return mutate((s, now) => {
      if (!missionAccepts(todayMission(s, now), kind)) throw new Error("Esta não é a missão de hoje.");
      if ((kind === "quiz" || kind === "review") && !gradeReview(answers ?? {}, completedDays(s)).passed)
        throw new Error("Para a revisão contar, acerte pelo menos 2 de 3.");
      const xp = settleDailyMission(s, now, kind);
      markActive(s, now);
      return xp;
    });
  },
  completeMission(slug: string): ActionResult {
    return mutate((s, now) => {
      const week = isoWeekKey(weekStartOf(spDate(now)));
      if (s.missionCompletions.some((m) => m.isoWeek === week)) return 0;
      s.missionCompletions.push({ isoWeek: week, slug, at: now.toISOString() });
      const a = awardXp(s.xpEvents, "weekly_mission", "W:" + week, now.toISOString());
      s.xpEvents = a.events;
      markActive(s, now);
      return a.awarded;
    });
  },
  /** Salva o plano e registra o evento (espelho de retirement_plans + record_plan_event). */
  savePlan(inputs: PlanInputs, reason: SnapshotReason, lifeReason?: string): ActionResult {
    return mutate((s, now) => {
      const iso = now.toISOString();
      const created = !s.plan;
      s.plan = s.plan ? { ...s.plan, inputs, updatedAt: iso } : { id: newId(), createdAt: iso, updatedAt: iso, inputs };
      const r: SnapshotReason = created ? "created" : reason;
      // Revisar as premissas no plano confirma os dados que estavam marcados como ausentes.
      if (!created) s.profile.missingFields = [];
      s.snapshots.unshift({
        id: newId(),
        reason: r,
        lifeReason,
        createdAt: iso,
        engineVersion: ENGINE_VERSION,
        inputs,
        requiredCentralSemInss: simulateAll(inputs).semInss.central.requiredMonthlyContribution,
      });
      const today = spDate(now);
      let a = { events: s.xpEvents, awarded: 0 };
      if (r === "created") a = awardXp(s.xpEvents, "first_plan_created", "ONCE", iso);
      else if (r === "quick_review") a = awardXp(s.xpEvents, "plan_quick_review", "M:" + today.slice(0, 7), iso);
      else if (r === "life_event") a = awardXp(s.xpEvents, "plan_life_event", "T:" + quarterKey(today), iso);
      else if (r === "annual_review" && planAgeDays(s.plan.createdAt, now) >= 180)
        a = awardXp(s.xpEvents, "annual_review", "Y:" + today.slice(0, 4), iso);
      s.xpEvents = a.events;
      markActive(s, now);
      return a.awarded;
    });
  },
  logContribution(input: { month: string; made: boolean; amount?: number | null; destination?: Destination | null; note?: string | null }): ActionResult {
    return mutate((s, now) => recordContribution(s, now, input).xp);
  },
  updateContribution(id: string, patch: Partial<Pick<Contribution, "amount" | "destination" | "note">>) {
    const s = structuredClone(load());
    s.contributions = s.contributions.map((c) => (c.id === id ? { ...c, ...patch } : c));
    commit(s);
  },
  deleteContribution(id: string) {
    const s = structuredClone(load());
    s.contributions = s.contributions.filter((c) => c.id !== id);
    commit(s);
  },
  /** Registra o patrimônio de um mês; um novo registro no mesmo mês substitui o anterior. */
  logWealth(input: { month: string; total: number; previdencia?: number | null; note?: string | null }): ActionResult {
    return mutate((s, now) => recordWealth(s, now, { ...input, breakdown: null }));
  },
  /** Registra o patrimônio deste mês com os itens cadastrados (espelho de log_wealth_from_assets). */
  logWealthFromAssets(note?: string | null): ActionResult {
    return mutate((s, now) => {
      if (s.assets.length === 0) throw new Error("Cadastre ao menos um item no Patrimônio.");
      const snap = snapshotFromAssets(s.assets);
      return recordWealth(s, now, { month: monthOf(spDate(now)), ...snap, note: note ?? null });
    });
  },
  /**
   * Com itens no Patrimônio, o registro do mês acompanha os itens sozinho: cria o do mês se não houver
   * e atualiza o que foi montado a partir dos itens. Um registro feito à mão (sem detalhamento) nunca é sobrescrito.
   * Devolve null quando não há nada a fazer.
   */
  refreshMonthlyWealth(): ActionResult | null {
    const s0 = load();
    if (s0.assets.length === 0) return null;
    const month = monthOf(spDate(new Date()));
    const entry = s0.wealthEntries.find((w) => w.month === month);
    const snap = snapshotFromAssets(s0.assets);
    if (entry && (entry.breakdown === null || (entry.total === snap.total && entry.previdencia === snap.previdencia))) return null;
    return mutate((s, now) => recordWealth(s, now, { month, ...snap, note: entry?.note ?? null }));
  },
  /** Cria ou atualiza um item do patrimônio (espelho de upsert_asset). Não concede XP. */
  saveAsset(input: { id?: string | undefined; name: string; category: AssetCategory; value: number; forRetirement: boolean; note?: string | null }) {
    const errors = validateAsset(input);
    if (errors.length) throw new Error(errors[0]);
    const s = structuredClone(load());
    const now = new Date();
    const previous = input.id ? s.assets.find((a) => a.id === input.id) : undefined;
    if (input.id && !previous) throw new Error("Item não encontrado.");
    // Com posições ou ligado a uma conta, o valor vem de lá, não do campo.
    const withHoldings = !!input.id && (valuedByHoldings(s, input.id) || !!linkedAccountOf(s, input.id));
    if (!!input.id && s.holdings.some((h) => h.assetId === input.id) && !holdsPositions(input.category)) throw new Error("Este item tem posições de investimento. Remova-as antes de mudar a categoria.");
    const item: Asset = {
      id: input.id ?? newId(),
      name: input.name.trim(),
      category: input.category,
      // Com posições, o valor vem delas, não do campo.
      value: withHoldings ? previous!.value : input.value,
      forRetirement: input.forRetirement,
      note: input.note ?? null,
      source: "manual",
      updatedAt: now.toISOString(),
    };
    s.assets = input.id ? s.assets.map((a) => (a.id === input.id ? item : a)) : [...s.assets, item];
    if (!previous || previous.value !== item.value) recordValuation(s, item.id, item.value, now);
    commit(s);
  },
  deleteAsset(id: string) {
    const s = structuredClone(load());
    const gone = new Set(s.holdings.filter((h) => h.assetId === id).map((h) => h.id));
    s.assets = s.assets.filter((a) => a.id !== id);
    s.assetValuations = s.assetValuations.filter((v) => v.assetId !== id);
    s.accounts = s.accounts.map((a) => (a.assetId === id ? { ...a, assetId: null } : a));
    s.holdings = s.holdings.filter((h) => !gone.has(h.id));
    s.trades = s.trades.filter((t) => !gone.has(t.holdingId));
    commit(s);
  },
  // ---------- Investimentos. Não concedem XP. ----------
  /** Cria ou edita uma posição dentro de um item do Patrimônio. `price` em centavos por unidade. */
  saveHolding(input: { id?: string | undefined; assetId: string; name: string; assetClass: AssetClass; price: number }) {
    const name = input.name.trim();
    if (!name) throw new Error("Dê um nome à posição (ex.: o código do ativo).");
    if (!(Number.isInteger(input.price) && input.price >= 0)) throw new Error("Preço inválido.");
    const s = structuredClone(load());
    const asset = s.assets.find((a) => a.id === input.assetId);
    if (!asset) throw new Error("Item do patrimônio não encontrado.");
    if (!holdsPositions(asset.category)) throw new Error("Posições só em itens de investimento ou previdência.");
    const now = new Date();
    const previous = input.id ? s.holdings.find((h) => h.id === input.id) : undefined;
    if (input.id && !previous) throw new Error("Posição não encontrada.");
    const h: Holding = {
      id: input.id ?? newId(),
      assetId: asset.id,
      name: name.slice(0, 60),
      assetClass: input.assetClass,
      price: input.price,
      priceUpdatedAt: previous && previous.price === input.price ? previous.priceUpdatedAt : now.toISOString(),
    };
    s.holdings = previous ? s.holdings.map((x) => (x.id === h.id ? h : x)) : [...s.holdings, h];
    syncAssetFromHoldings(s, asset.id, now);
    if (previous && previous.assetId !== asset.id) syncAssetFromHoldings(s, previous.assetId, now);
    commit(s);
  },
  /** Remove a posição e as operações dela; o item volta a ter o valor que as outras posições somam. */
  deleteHolding(id: string) {
    const s = structuredClone(load());
    const h = s.holdings.find((x) => x.id === id);
    if (!h) return;
    s.holdings = s.holdings.filter((x) => x.id !== id);
    s.trades = s.trades.filter((t) => t.holdingId !== id);
    syncAssetFromHoldings(s, h.assetId, new Date());
    commit(s);
  },
  /** Lança compra, venda ou provento. Valores em centavos; em provento, `unitPrice` é o total recebido. */
  addTrade(input: { holdingId: string; date: string; type: TradeType; quantity: number; unitPrice: number; fees?: number }): ActionResult {
    return mutate((s, now) => {
      const h = s.holdings.find((x) => x.id === input.holdingId);
      if (!h) throw new Error("Posição não encontrada.");
      if (!isDate(input.date) || input.date > spDate(now)) throw new Error("Informe uma data até hoje.");
      const fees = input.fees ?? 0;
      if (!(Number.isInteger(fees) && fees >= 0)) throw new Error("Taxas inválidas.");
      if (!(Number.isInteger(input.unitPrice) && input.unitPrice > 0)) throw new Error(input.type === "provento" ? "Informe o valor recebido." : "Informe o preço.");
      const quantity = input.type === "provento" ? 0 : input.quantity;
      if (input.type !== "provento" && !(Number.isFinite(quantity) && quantity > 0)) throw new Error("Informe a quantidade.");
      const t: PortfolioTrade = { id: newId(), holdingId: h.id, date: input.date, type: input.type, quantity, unitPrice: input.unitPrice, fees };
      const all = [...s.trades.filter((x) => x.holdingId === h.id), t];
      if (positionFromTrades(all).oversold) throw new Error("A venda passa da quantidade que você tinha nessa data.");
      s.trades.push(t);
      syncAssetFromHoldings(s, h.assetId, now);
      // XP pelo hábito de registrar os investimentos, uma vez por mês; o valor investido não conta.
      const a = awardXp(s.xpEvents, "investment_logged", "M:" + spDate(now).slice(0, 7), now.toISOString());
      s.xpEvents = a.events;
      markActive(s, now);
      return a.awarded;
    });
  },
  deleteTrade(id: string) {
    const s = structuredClone(load());
    const t = s.trades.find((x) => x.id === id);
    if (!t) return;
    const rest = s.trades.filter((x) => x.id !== id);
    if (positionFromTrades(rest.filter((x) => x.holdingId === t.holdingId)).oversold)
      throw new Error("Sem esta compra, uma venda posterior passaria da quantidade. Exclua a venda antes.");
    s.trades = rest;
    const h = s.holdings.find((x) => x.id === t.holdingId);
    if (h) syncAssetFromHoldings(s, h.assetId, new Date());
    commit(s);
  },
  /** Metas de alocação por classe, em %; precisam somar 100. Vazio apaga as metas. */
  setAllocationTargets(targets: Partial<Record<AssetClass, number>>): ActionResult {
    const clean = Object.fromEntries(Object.entries(targets).filter(([, v]) => v != null && v > 0)) as Partial<Record<AssetClass, number>>;
    if (Object.keys(clean).length) {
      const errors = validateTargets(clean);
      if (errors.length) throw new Error(errors[0]);
    }
    // Sem XP; a conquista "Carteira com metas" sai no refresh.
    return mutate((s) => {
      s.allocationTargets = clean;
      return 0;
    });
  },
  updateWealth(id: string, patch: Partial<Pick<WealthEntry, "total" | "previdencia" | "note">>) {
    const s = structuredClone(load());
    s.wealthEntries = s.wealthEntries.map((w) => (w.id === id ? { ...w, ...patch } : w));
    commit(s);
  },
  deleteWealth(id: string) {
    const s = structuredClone(load());
    s.wealthEntries = s.wealthEntries.filter((w) => w.id !== id);
    commit(s);
  },
  createGoal(input: { title: string; kind: GoalKind; target?: number | null; deadline?: string | null }): ActionResult {
    return mutate((s, now) => {
      const title = input.title.trim();
      if (!title) throw new Error("Dê um nome para a meta.");
      if (input.kind === "valor" && !(input.target && input.target > 0)) throw new Error("Informe o valor da meta.");
      const id = newId();
      s.goals.push({
        id,
        title,
        kind: input.kind,
        target: input.kind === "valor" ? (input.target ?? null) : null,
        deadline: input.deadline ?? null,
        createdAt: now.toISOString(),
        completedAt: null,
      });
      let xp = 0;
      const key = goalCreatedPeriodKey(s.xpEvents, spDate(now), id);
      if (key) {
        const a = awardXp(s.xpEvents, "goal_created", key, now.toISOString());
        s.xpEvents = a.events;
        xp = a.awarded;
      }
      markActive(s, now);
      return xp;
    });
  },
  completeGoal(id: string): ActionResult {
    return mutate((s, now) => {
      const goal = s.goals.find((g) => g.id === id);
      if (!goal || goal.completedAt) return 0;
      goal.completedAt = now.toISOString();
      const a = awardXp(s.xpEvents, "goal_completed", "G:" + id, now.toISOString());
      s.xpEvents = a.events;
      markActive(s, now);
      return a.awarded;
    });
  },
  deleteGoal(id: string) {
    const s = structuredClone(load());
    s.goals = s.goals.filter((g) => g.id !== id);
    commit(s);
  },
  startChallenge(slug: string): ActionResult {
    return mutate((s, now) => {
      if (!challengeBySlug(slug)) throw new Error("Desafio não encontrado.");
      const running = activeChallenges(s, now);
      if (running.some((c) => c.run.slug === slug)) return 0;
      if (running.length >= MAX_ACTIVE_CHALLENGES)
        throw new Error(`Você já tem ${MAX_ACTIVE_CHALLENGES} desafios em andamento.`);
      s.challenges.push({ slug, startedAt: now.toISOString(), completedAt: null });
      return 0;
    });
  },
  abandonChallenge(slug: string) {
    const s = structuredClone(load());
    const running = new Set(activeChallenges(s).map((c) => c.run.startedAt));
    s.challenges = s.challenges.filter((c) => !(c.slug === slug && running.has(c.startedAt)));
    commit(s);
  },
  // ---------- Livro-caixa: contas, lançamentos, recorrências, importação e regras. Não concedem XP. ----------
  /** Cria ou edita a conta. `assetId` liga a conta (previdência ou investimentos) a um item do Patrimônio. */
  saveAccount(input: { id?: string | undefined; name: string; kind: AccountKind; openingBalance: number; assetId?: string | null }) {
    const name = input.name.trim();
    if (!name) throw new Error("Dê um nome à conta.");
    if (!Number.isInteger(input.openingBalance)) throw new Error("Saldo inicial inválido.");
    const s = structuredClone(load());
    const assetId = input.assetId ?? null;
    if (assetId) {
      if (!isSavingsAccount(input.kind)) throw new Error("Só contas de previdência ou investimentos podem ser ligadas a um item do Patrimônio.");
      const asset = s.assets.find((a) => a.id === assetId);
      if (!asset) throw new Error("Item do Patrimônio não encontrado.");
      if (valuedByHoldings(s, assetId)) throw new Error("O valor deste item já vem das posições de investimento.");
      if (s.accounts.some((a) => a.assetId === assetId && a.id !== input.id)) throw new Error("Este item já está ligado a outra conta.");
    }
    if (input.id) {
      if (!s.accounts.some((a) => a.id === input.id)) throw new Error("Conta não encontrada.");
      s.accounts = s.accounts.map((a) => (a.id === input.id ? { ...a, name, kind: input.kind, openingBalance: input.openingBalance, assetId } : a));
    } else s.accounts.push({ id: newId(), name, kind: input.kind, openingBalance: input.openingBalance, createdAt: new Date().toISOString(), assetId });
    commit(s);
  },
  /** Exclui a conta com seus lançamentos, recorrências e a outra perna das transferências. */
  deleteAccount(id: string) {
    const s = structuredClone(load());
    const gone = new Set(s.transactions.filter((t) => t.accountId === id).flatMap((t) => [t.id, ...(t.transferId ? [t.transferId] : [])]));
    s.accounts = s.accounts.filter((a) => a.id !== id);
    s.transactions = s.transactions.filter((t) => !gone.has(t.id));
    s.recurring = s.recurring.filter((r) => r.accountId !== id);
    commit(s);
  },
  saveCategory(input: { id?: string | undefined; name: string; kind: CategoryKind }) {
    const name = input.name.trim();
    if (!name) throw new Error("Dê um nome à categoria.");
    const s = structuredClone(load());
    if (s.categories.some((c) => c.id !== input.id && c.kind === input.kind && normalize(c.name) === normalize(name)))
      throw new Error("Já existe uma categoria com esse nome.");
    if (input.id) s.categories = s.categories.map((c) => (c.id === input.id ? { ...c, name, kind: input.kind } : c));
    else s.categories.push({ id: newId(), name, kind: input.kind });
    commit(s);
  },
  /** Os lançamentos da categoria ficam sem categoria; as regras e recorrências dela, também. */
  deleteCategory(id: string) {
    const s = structuredClone(load());
    s.categories = s.categories.filter((c) => c.id !== id);
    s.transactions = s.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t));
    s.recurring = s.recurring.map((r) => (r.categoryId === id ? { ...r, categoryId: null } : r));
    s.categoryRules = s.categoryRules.filter((r) => r.categoryId !== id);
    // O envelope da categoria some; o que estava distribuído nele volta para "a distribuir".
    s.budget.templates = s.budget.templates.filter((t) => t.envelopeId !== id);
    for (const m of Object.values(s.budget.assigned)) delete m[id];
    commit(s);
  },
  // ---------- Orçamento por envelopes. Planejar o mês dá XP uma vez por mês. ----------
  /** Define quanto vai para o envelope no mês (centavos). Negativo devolve saldo de meses anteriores. */
  setAssigned(month: string, envelopeId: string, amount: number): ActionResult {
    if (!Number.isInteger(amount)) throw new Error("Valor inválido.");
    return mutate((s, now) => {
      const m = monthOf(month);
      if (m > shiftMonth(monthOf(spDate(now)), BUDGET_MONTHS_AHEAD)) throw new Error("Dá para planejar até dois meses à frente.");
      const row = (s.budget.assigned[m] ??= {});
      if (amount === 0) delete row[envelopeId];
      else row[envelopeId] = amount;
      return amount > 0 ? awardBudgetPlanned(s, now, m) : 0;
    });
  },
  /** Passa dinheiro de um envelope para outro no mesmo mês, para cobrir um estouro, por exemplo. */
  moveBudget(month: string, fromId: string, toId: string, amount: number): ActionResult {
    if (!(Number.isInteger(amount) && amount > 0)) throw new Error("Informe um valor maior que zero.");
    if (fromId === toId) throw new Error("Escolha dois envelopes diferentes.");
    return mutate((s) => {
      const row = (s.budget.assigned[monthOf(month)] ??= {});
      row[fromId] = (row[fromId] ?? 0) - amount;
      row[toId] = (row[toId] ?? 0) + amount;
      return 0;
    });
  },
  /** Um modelo por envelope; salvar de novo substitui. */
  saveTemplate(t: BudgetTemplate) {
    const errors = validateTemplate(t);
    if (errors.length) throw new Error(errors[0]);
    const s = structuredClone(load());
    if (!budgetEnvelopeIds(s).includes(t.envelopeId)) throw new Error("Envelope não encontrado.");
    s.budget.templates = [...s.budget.templates.filter((x) => x.envelopeId !== t.envelopeId), { ...t, deadline: t.deadline ? monthOf(t.deadline) : null }];
    commit(s);
  },
  deleteTemplate(envelopeId: string) {
    const s = structuredClone(load());
    s.budget.templates = s.budget.templates.filter((t) => t.envelopeId !== envelopeId);
    commit(s);
  },
  /** Preenche o mês com o que os modelos pedem. Só mexe nos envelopes que têm modelo. Devolve o total aplicado. */
  applyTemplates(month: string): ActionResult & { total: number } {
    let total = 0;
    const r = mutate((s, now) => {
      const m = monthOf(month);
      const prev = budgetMonths(s, shiftMonth(m, -1)).at(-1);
      const income = budgetActivity(budgetTxInputs(s))[m]?.income ?? 0;
      const row = (s.budget.assigned[m] ??= {});
      for (const t of s.budget.templates) {
        const carry = Math.max(prev?.envelopes[t.envelopeId]?.balance ?? 0, 0);
        const amount = templateAmount(t, m, carry, income);
        if (amount > 0) row[t.envelopeId] = amount;
        else delete row[t.envelopeId];
        total += amount;
      }
      return total > 0 ? awardBudgetPlanned(s, now, m) : 0;
    });
    return { ...r, total };
  },
  /**
   * Lança uma entrada ou saída. Sem categoria, as regras escolhem uma.
   * `remember` cria a regra "favorecido igual a … → esta categoria" para os próximos.
   */
  addTransaction(input: { accountId: string; date: string; amount: number; payee: string; categoryId?: string | null; note?: string | null; remember?: boolean }) {
    const s = structuredClone(load());
    const t = validTx(s, input);
    const withRule = applyRules(s.categoryRules, { ...t, categoryId: input.categoryId ?? null });
    s.transactions.push(newTransaction({ ...withRule, note: input.note ?? null }, new Date()));
    if (input.remember) rememberRule(s, t.payee, input.categoryId ?? null);
    commit(s);
  },
  /** Edita um lançamento. Numa transferência, valor, data e nota mudam nas duas pernas. */
  updateTransaction(id: string, patch: { date?: string; amount?: number; payee?: string; categoryId?: string | null; note?: string | null; remember?: boolean }) {
    const s = structuredClone(load());
    const t = s.transactions.find((x) => x.id === id);
    if (!t) throw new Error("Lançamento não encontrado.");
    const next = { ...t, ...validTx(s, { ...t, ...patch }), note: patch.note === undefined ? t.note : patch.note };
    if (t.transferId) {
      next.categoryId = null;
      if (next.amount * t.amount < 0) throw new Error("Numa transferência, troque a direção excluindo e lançando de novo.");
      s.transactions = s.transactions.map((x) =>
        x.id === t.transferId ? { ...x, date: next.date, amount: -next.amount, note: next.note } : x.id === id ? next : x,
      );
    } else {
      next.categoryId = patch.categoryId === undefined ? t.categoryId : patch.categoryId;
      s.transactions = s.transactions.map((x) => (x.id === id ? next : x));
      if (patch.remember) rememberRule(s, next.payee, next.categoryId);
    }
    commit(s);
  },
  /** Exclui o lançamento e, se for transferência, a outra perna. O aporte do Diário, se houver, continua lá. */
  deleteTransaction(id: string) {
    const s = structuredClone(load());
    const t = s.transactions.find((x) => x.id === id);
    s.transactions = s.transactions.filter((x) => x.id !== id && x.id !== t?.transferId);
    commit(s);
  },
  /**
   * Transfere entre duas contas (espelho de create_transfer). Para previdência ou investimentos,
   * `contribution` também registra o aporte do mês no Diário, com o XP de sempre.
   */
  addTransfer(input: { fromId: string; toId: string; date: string; amount: number; note?: string | null; contribution?: Destination | null }): ActionResult {
    return mutate((s, now) => {
      if (input.fromId === input.toId) throw new Error("Escolha duas contas diferentes.");
      const from = s.accounts.find((a) => a.id === input.fromId);
      const to = s.accounts.find((a) => a.id === input.toId);
      if (!from || !to) throw new Error("Conta não encontrada.");
      if (!(Number.isInteger(input.amount) && input.amount > 0)) throw new Error("Informe um valor maior que zero.");
      if (!isDate(input.date)) throw new Error("Data inválida.");
      const out = newTransaction({ accountId: from.id, date: input.date, amount: -input.amount, payee: `Transferência para ${to.name}`, note: input.note ?? null }, now);
      const inn = newTransaction({ accountId: to.id, date: input.date, amount: input.amount, payee: `Transferência de ${from.name}`, note: input.note ?? null }, now);
      out.transferId = inn.id;
      inn.transferId = out.id;
      let xp = 0;
      if (input.contribution) {
        if (!isSavingsAccount(to.kind)) throw new Error("Só transferências para previdência ou investimentos contam como aporte.");
        const c = recordContribution(s, now, { month: input.date, made: true, amount: input.amount / 100, destination: input.contribution, note: input.note ?? null });
        out.contributionId = c.id;
        xp = c.xp;
      }
      s.transactions.push(out, inn);
      return xp;
    });
  },
  saveRecurring(input: Omit<RecurringRule, "id" | "active"> & { id?: string | undefined; active?: boolean }) {
    const errors = validateRule(input);
    if (errors.length) throw new Error(errors[0]);
    const s = structuredClone(load());
    validTx(s, { accountId: input.accountId, date: input.startDate, amount: input.amount, payee: input.payee });
    const { id, active, ...rest } = input;
    const rule: RecurringRule = { ...rest, payee: input.payee.trim(), id: id ?? newId(), active: active ?? true };
    s.recurring = id ? s.recurring.map((r) => (r.id === id ? rule : r)) : [...s.recurring, rule];
    materializeRecurring(s, new Date());
    commit(s);
  },
  /** Remove a regra; os lançamentos que ela já gerou continuam. */
  deleteRecurring(id: string) {
    const s = structuredClone(load());
    s.recurring = s.recurring.filter((r) => r.id !== id);
    s.transactions = s.transactions.map((t) => (t.recurringId === id ? { ...t, recurringId: null } : t));
    commit(s);
  },
  /** Lança as recorrências vencidas. Pode rodar quantas vezes quiser: nunca duplica. */
  runRecurring(): number {
    const s = structuredClone(load());
    const added = materializeRecurring(s, new Date());
    if (added) commit(s);
    return added;
  },
  /** Importa um extrato para a conta (espelho de import_transactions). Duplicados ficam de fora. */
  importTransactions(accountId: string, rows: ImportedTx[]) {
    let counts = { added: 0, matched: 0, duplicates: 0 };
    const result = mutate((s, now) => {
      if (!s.accounts.some((a) => a.id === accountId)) throw new Error("Conta não encontrada.");
      const existing = s.transactions
        .filter((t) => t.accountId === accountId && !t.transferId)
        .map((t) => ({ id: t.id, date: t.date, amount: t.amount, payee: t.payee, importedId: t.importedId, imported: t.source === "importado" }));
      const r = dedupe(rows, existing);
      // O lançamento manual fica (com a categoria da pessoa) e passa a carregar o identificador do banco.
      const link = new Map(r.matched.map((m) => [m.existingId, m.tx.importedId]));
      s.transactions = s.transactions.map((t) => (link.has(t.id) ? { ...t, importedId: link.get(t.id) ?? t.importedId } : t));
      for (const row of r.fresh) {
        const t = applyRules(s.categoryRules, { accountId, date: row.date, amount: row.amount, payee: row.payee.slice(0, 120), categoryId: null as string | null });
        s.transactions.push(newTransaction({ ...t, note: row.memo, importedId: row.importedId, source: "importado" }, now));
      }
      counts = { added: r.fresh.length, matched: r.matched.length, duplicates: r.duplicates.length };
      if (!r.fresh.length) return 0;
      // XP pelo hábito de trazer o extrato, uma vez por mês; quantos lançamentos vieram não conta.
      const a = awardXp(s.xpEvents, "statement_imported", "M:" + spDate(now).slice(0, 7), now.toISOString());
      s.xpEvents = a.events;
      markActive(s, now);
      return a.awarded;
    });
    return { ...result, ...counts };
  },
  saveCategoryRule(input: { id?: string | undefined; op: RuleOp; value: string; categoryId: string; renameTo?: string | null }) {
    const value = input.value.trim();
    if (!value) throw new Error("Informe o texto que a regra procura.");
    const s = structuredClone(load());
    if (!s.categories.some((c) => c.id === input.categoryId)) throw new Error("Categoria não encontrada.");
    const rule: CategoryRule = { id: input.id ?? newId(), op: input.op, value, categoryId: input.categoryId, renameTo: input.renameTo?.trim() || null };
    s.categoryRules = input.id ? s.categoryRules.map((r) => (r.id === input.id ? rule : r)) : [...s.categoryRules, rule];
    commit(s);
  },
  deleteCategoryRule(id: string) {
    const s = structuredClone(load());
    s.categoryRules = s.categoryRules.filter((r) => r.id !== id);
    commit(s);
  },
  /** Fecha o mês atual (espelho de complete_month_close): só com os cinco passos feitos; XP uma vez por mês. */
  closeMonth(): ActionResult {
    return mutate((s, now) => {
      const c = monthCloseSteps(s, now);
      if (!c.complete) throw new Error("Ainda faltam passos para fechar o mês.");
      const a = awardXp(s.xpEvents, "month_closed", "M:" + c.month.slice(0, 7), now.toISOString());
      s.xpEvents = a.events;
      markActive(s, now);
      return a.awarded;
    });
  },
  exportData() {
    return { exported_at: new Date().toISOString(), modo: backend === "cloud" ? "conta" : "demonstracao", ...load() };
  },
};

type DemoOps = typeof rawDemo;
type OpObserver = (op: string, prev: DemoState, next: DemoState) => void;
const observers = new Set<OpObserver>();
/** Acompanha cada operação feita (nos dois modos), por exemplo para o analytics do funil. */
export function observeOps(fn: OpObserver) {
  observers.add(fn);
  return () => observers.delete(fn);
}

/**
 * As operações que as telas usam. No modo nuvem, cada uma roda aqui na hora (a tela responde sem esperar a rede)
 * e o sincronizador recebe o estado de antes e de depois para gravar no banco e recarregar de lá.
 */
export const demo: DemoOps = Object.fromEntries(
  Object.entries(rawDemo).map(([name, fn]) => [
    name,
    (...args: unknown[]) => {
      const run = fn as (...a: unknown[]) => unknown;
      if (name === "exportData") return run(...args);
      const prev = load();
      const out = run(...args);
      const next = load();
      if (backend === "cloud" && syncHandler && (next !== prev || name === "runRecurring")) syncHandler(name, args, prev, next);
      if (next !== prev)
        observers.forEach((o) => {
          try {
            o(name, prev, next);
          } catch {
            /* um observador nunca derruba a operação */
          }
        });
      return out;
    },
  ]),
) as DemoOps;
