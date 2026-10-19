// Camada de dados em MODO DEMONSTRAÇÃO (sem login): guarda o estado só neste aparelho.
// Na etapa de login, as mesmas operações passam a chamar as RPCs do Supabase (§6.1).
import { useSyncExternalStore } from "react";
import { ENGINE_VERSION, simulateAll, type PlanInputs } from "@/lib/calc/retirement";
import {
  addMonths,
  awardXp,
  computeLevel,
  computeStreak,
  eligibleAchievements,
  isoWeekKey,
  monthOf,
  quarterKey,
  spDate,
  weekStartOf,
  type AchievementCode,
  type WeekRecord,
  type XpEvent,
} from "@/lib/gamification/rules";
import { PROGRAM } from "@/content/program";

export type WorkType = "pj" | "autonomo" | "mei" | "clt" | "servidor" | "outro";
export type Destination = "previdencia" | "investimentos" | "reserva" | "outro";
export type SnapshotReason = "created" | "edit" | "quick_review" | "life_event" | "annual_review";

export type Profile = {
  displayName: string;
  birthYear: number | null;
  workType: WorkType | null;
  hasOverdueDebt: boolean | null;
  emergencyFundReady: boolean;
  monthlyReminder: boolean;
  reminderDay: number;
  weeklyReminder: boolean;
  analyticsConsent: boolean;
  onboardingCompletedAt: string | null;
  goalRetirementAge: number | null;
  goalIncome: number | null;
};

export type Plan = { id: string; createdAt: string; updatedAt: string; inputs: PlanInputs };
export type Snapshot = {
  id: string;
  reason: SnapshotReason;
  lifeReason?: string | undefined;
  createdAt: string;
  engineVersion: string;
  inputs: PlanInputs;
  requiredCentralSemInss: number;
};
export type Contribution = {
  id: string;
  month: string;
  made: boolean;
  amount: number | null;
  destination: Destination | null;
  note: string | null;
  createdAt: string;
};

export type DemoState = {
  version: 1;
  profile: Profile;
  plan: Plan | null;
  snapshots: Snapshot[];
  contributions: Contribution[];
  program: { currentDay: number; startedAt: string; completedAt: string | null };
  lessonCompletions: Record<number, string>;
  answers: Record<string, { selected: string; correct: boolean }>;
  missionCompletions: { isoWeek: string; slug: string; at: string }[];
  xpEvents: XpEvent[];
  weeks: WeekRecord[];
  achievements: { code: AchievementCode; at: string }[];
  stats: { totalXp: number; level: number; weekStreak: number; bestWeekStreak: number };
};

export type ActionResult = {
  xpAwarded: number;
  newAchievements: AchievementCode[];
  totalXp: number;
  level: number;
  weekStreak: number;
};

const KEY = "pi_demo_state_v1";

export const DEFAULT_ASSUMPTIONS = {
  horizonAge: 95,
  returns: { conservador: 0.02, central: 0.04, otimista: 0.06 },
  inflationAA: 0.04,
  costsAA: 0,
};

let idSeq = 0;
const newId = () => `${Date.now().toString(36)}-${(idSeq++).toString(36)}`;

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
  for (let d = 1; d <= 14; d++) lessonCompletions[d] = iso;
  const xpEvents: XpEvent[] = [];
  for (let d = 1; d <= 14; d++) xpEvents.push({ action: "lesson_completed", periodKey: `D:seed-${d}`, xp: 10, at: iso });
  xpEvents.push({ action: "first_plan_created", periodKey: "ONCE", xp: 100, at: iso });
  // Só o mês anterior ainda gera XP em tempo real; os mais antigos foram "registrados em dia" na época.
  for (const c of contributions.filter((c) => c.made))
    xpEvents.push({ action: "contribution_logged", periodKey: "M:" + c.month.slice(0, 7), xp: 50, at: iso });
  const thisWeek = weekStartOf(today);
  const weeks: WeekRecord[] = [1, 2, 3].map((k) => ({
    weekStart: weekStartOf(addDaysIso(thisWeek, -7 * k)),
    status: "ativa" as const,
  }));
  const s: DemoState = {
    version: 1,
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
    stats: { totalXp: 0, level: 1, weekStreak: 0, bestWeekStreak: 0 },
  };
  refresh(s, now);
  s.achievements = s.achievements.map((a) => ({ ...a }));
  return s;
}

function addDaysIso(day: string, n: number) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Recalcula sequência, nível, conquistas e XP total (espelho de _refresh_progress). */
function refresh(s: DemoState, now: Date): AchievementCode[] {
  const today = spDate(now);
  const { streak, weeks } = computeStreak(s.weeks, today);
  s.weeks = weeks;
  const contribMonths = s.xpEvents.filter((e) => e.action === "contribution_logged").map((e) => e.periodKey.slice(2) + "-01");
  const level = computeLevel(contribMonths.length, !!s.plan);
  const eligible = eligibleAchievements({
    hasPlan: !!s.plan,
    contributionMonthKeys: contribMonths,
    emergencyFundReady: s.profile.emergencyFundReady,
    hasLifeEvent: s.snapshots.some((x) => x.reason === "life_event"),
    programCompleted: !!s.program.completedAt,
    hasAnnualReview: s.xpEvents.some((e) => e.action === "annual_review"),
  });
  const have = new Set(s.achievements.map((a) => a.code));
  const fresh = eligible.filter((c) => !have.has(c));
  s.achievements = [...s.achievements, ...fresh.map((code) => ({ code, at: now.toISOString() }))];
  const totalXp = s.xpEvents.reduce((a, e) => a + e.xp, 0);
  s.stats = { totalXp, level, weekStreak: streak, bestWeekStreak: Math.max(s.stats.bestWeekStreak, streak) };
  return fresh;
}

function markWeekActive(s: DemoState, now: Date) {
  const ws = weekStartOf(spDate(now));
  s.weeks = [...s.weeks.filter((w) => w.weekStart !== ws), { weekStart: ws, status: "ativa" }];
}

// ---------- Store ----------
let state: DemoState | null = null;
const listeners = new Set<() => void>();

function load(): DemoState {
  if (state) return state;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    state = raw ? (JSON.parse(raw) as DemoState) : makeSeed();
  } catch {
    state = makeSeed();
  }
  return state;
}
function commit(next: DemoState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* armazenamento indisponível */
  }
  listeners.forEach((l) => l());
}
function mutate(fn: (s: DemoState, now: Date) => number): ActionResult {
  const now = new Date();
  const s: DemoState = structuredClone(load());
  const xp = fn(s, now);
  const fresh = refresh(s, now);
  commit(s);
  return { xpAwarded: xp, newAchievements: fresh, totalXp: s.stats.totalXp, level: s.stats.level, weekStreak: s.stats.weekStreak };
}

let serverSeed: DemoState | null = null;
export function useDemo(): DemoState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    load,
    () => (serverSeed ??= makeSeed()),
  );
}

// ---------- Operações (mesma forma das RPCs) ----------
export const demo = {
  reset() {
    commit(makeSeed());
  },
  startFresh() {
    const s = makeSeed();
    commit({
      ...s,
      profile: { ...s.profile, displayName: "", onboardingCompletedAt: null, birthYear: null, workType: null, hasOverdueDebt: null },
      plan: null,
      snapshots: [],
      contributions: [],
      program: { currentDay: 1, startedAt: new Date().toISOString(), completedAt: null },
      lessonCompletions: {},
      answers: {},
      missionCompletions: [],
      xpEvents: [],
      weeks: [],
      achievements: [],
      stats: { totalXp: 0, level: 1, weekStreak: 0, bestWeekStreak: 0 },
    });
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
      if (day > s.program.currentDay) throw new Error("Esta lição ainda não abriu.");
      let xp = 0;
      if (!s.lessonCompletions[day]) {
        s.lessonCompletions[day] = now.toISOString();
        const a = awardXp(s.xpEvents, "lesson_completed", "D:" + spDate(now), now.toISOString());
        s.xpEvents = a.events;
        xp += a.awarded;
      }
      s.program.currentDay = Math.max(s.program.currentDay, day + 1);
      if (Object.keys(s.lessonCompletions).length >= PROGRAM.totalDays) {
        s.program.completedAt ??= now.toISOString();
        const a = awardXp(s.xpEvents, "program_completed", "P:" + PROGRAM.slug, now.toISOString());
        s.xpEvents = a.events;
        xp += a.awarded;
        done = true;
      }
      markWeekActive(s, now);
      return xp;
    });
    return { ...r, programCompleted: done };
  },
  completeMission(slug: string): ActionResult {
    return mutate((s, now) => {
      const week = isoWeekKey(weekStartOf(spDate(now)));
      if (s.missionCompletions.some((m) => m.isoWeek === week)) return 0;
      s.missionCompletions.push({ isoWeek: week, slug, at: now.toISOString() });
      const a = awardXp(s.xpEvents, "weekly_mission", "W:" + week, now.toISOString());
      s.xpEvents = a.events;
      markWeekActive(s, now);
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
      markWeekActive(s, now);
      return a.awarded;
    });
  },
  logContribution(input: { month: string; made: boolean; amount?: number | null; destination?: Destination | null; note?: string | null }): ActionResult {
    return mutate((s, now) => {
      const current = monthOf(spDate(now));
      const month = monthOf(input.month);
      if (month > current) throw new Error("Não é possível registrar um mês futuro.");
      s.contributions.push({
        id: newId(),
        month,
        made: input.made,
        amount: input.made ? (input.amount ?? null) : null,
        destination: input.destination ?? null,
        note: input.note ?? null,
        createdAt: now.toISOString(),
      });
      let xp = 0;
      if (input.made && month >= addMonths(current, -1)) {
        const a = awardXp(s.xpEvents, "contribution_logged", "M:" + month.slice(0, 7), now.toISOString());
        s.xpEvents = a.events;
        xp = a.awarded;
      }
      markWeekActive(s, now);
      return xp;
    });
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
  exportData() {
    return { exported_at: new Date().toISOString(), modo: "demonstracao", ...load() };
  },
};

export function planAgeDays(createdAt: string, now = new Date()) {
  return Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86400000);
}

/** Lição de hoje: uma nova por dia (horário de Brasília). */
export function lessonStatus(s: DemoState, now = new Date()) {
  const today = spDate(now);
  const doneToday = Object.values(s.lessonCompletions).some((iso) => spDate(new Date(iso)) === today);
  const day = Math.min(s.program.currentDay, PROGRAM.totalDays);
  return { day, doneToday, finished: !!s.program.completedAt };
}

/** Plano padrão a partir do onboarding. */
export function inputsFromProfile(p: Profile, now = new Date()): PlanInputs {
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

export const CALC_PREFILL_KEY = "calc_prefill";
export type CalcPrefill = { currentAge: number; retirementAge: number; desiredIncome: number };
