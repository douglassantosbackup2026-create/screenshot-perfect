// Modo nuvem: o estado das telas vem do banco (Supabase) e cada operação é gravada lá.
// As telas continuam chamando `demo.*` de forma síncrona: a operação roda na hora em memória (src/lib/data/demo-store.ts)
// e este módulo grava no banco (RPC quando há regra no servidor; senão, a diferença entre o antes e o depois nas tabelas)
// e recarrega tudo do banco quando a fila esvazia. O banco é a fonte da verdade: XP, conquistas e ids vêm de lá.
import { useSyncExternalStore } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { identify } from "@/lib/analytics";
import { ENGINE_VERSION, type PlanInputs } from "@/lib/calc/retirement";
import type { AssetClass } from "@/lib/calc/portfolio";
import {
  emptyState,
  getState,
  holdingsValue,
  replaceState,
  useBackend,
  valuedByHoldings,
  type Account,
  type Asset,
  type Category,
  type Contribution,
  type DemoState,
  type Goal,
  type Holding,
  type PortfolioTrade,
  type Profile,
  type RecurringRule,
  type Transaction,
  type WealthEntry,
} from "./demo-store";
import type { CategoryRule } from "@/lib/calc/categorize";
import type { BudgetTemplate } from "@/lib/calc/budget";

// Os tipos gerados ainda não têm as tabelas novas; até regenerar, o acesso é sem tipo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as SupabaseClient<any>;

// ---------- Estado do sincronizador (para a tela de carregamento e o perfil) ----------
type CloudStatus = { userId: string | null; loaded: boolean; syncing: boolean; isAdmin: boolean; error: string | null };
let status: CloudStatus = { userId: null, loaded: false, syncing: false, isAdmin: false, error: null };
const listeners = new Set<() => void>();
const setStatus = (patch: Partial<CloudStatus>) => {
  status = { ...status, ...patch };
  listeners.forEach((l) => l());
};
const SERVER_STATUS = status;
export function useCloudStatus(): CloudStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => SERVER_STATUS,
  );
}

// Ids de conteúdo do servidor: lição por dia, pergunta por "dia-posição", missão semanal por slug.
let lessonIdByDay = new Map<number, string>();
let dayByLessonId = new Map<string, number>();
let questionIdByKey = new Map<string, string>();
let keyByQuestionId = new Map<string, string>();
let missionIdBySlug = new Map<string, string>();
let slugByMissionId = new Map<string, string>();
let planId: string | null = null;

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}
const rows = <T = Record<string, unknown>>(table: string, cols = "*") => must<T[]>(db.from(table).select(cols));

// ---------- Carregar ----------
/** Lê tudo da conta e monta o estado que as telas usam. */
export async function loadAll(userId: string): Promise<DemoState> {
  // Recorrências vencidas entram antes da leitura; categorias padrão na primeira vez.
  await db.rpc("materialize_recurring");
  const [
    profile,
    plans,
    snapshots,
    contributions,
    wealth,
    goals,
    userChallenges,
    assets,
    valuations,
    accounts,
    categories,
    transactions,
    recurring,
    categoryRules,
    assignments,
    templates,
    holdings,
    trades,
    targets,
    xp,
    stats,
    achievements,
    weeks,
    days,
    lessonDone,
    answers,
    missions,
    daily,
    program,
    lessons,
    weekly,
    roles,
  ] = await Promise.all([
    must(db.from("profiles").select("*").eq("id", userId).maybeSingle()),
    rows("retirement_plans"),
    must<Record<string, unknown>[]>(db.from("plan_snapshots").select("*").order("created_at", { ascending: false })),
    rows("contributions"),
    rows("wealth_entries"),
    rows("goals"),
    rows("user_challenges"),
    rows("assets"),
    rows("asset_valuations"),
    rows("accounts"),
    rows("categories"),
    rows("transactions"),
    rows("recurring_rules"),
    rows("category_rules"),
    rows("budget_assignments"),
    rows("budget_templates"),
    rows("holdings"),
    rows("trades"),
    rows("allocation_targets"),
    rows("xp_events"),
    must(db.from("user_stats").select("*").eq("user_id", userId).maybeSingle()),
    rows("user_achievements"),
    rows("week_activity"),
    rows("day_activity"),
    rows("lesson_completions"),
    rows("question_answers"),
    rows("mission_completions"),
    rows("daily_mission_completions"),
    must(db.from("user_program_progress").select("*").eq("user_id", userId).maybeSingle()),
    rows("lessons", "id, day"),
    rows("weekly_missions", "id, slug"),
    rows("user_roles", "role"),
  ]);

  if (categories.length === 0) {
    await must(db.rpc("seed_default_categories"));
    categories.push(...(await rows("categories")));
  }

  lessonIdByDay = new Map(lessons.map((l) => [Number(l["day"]), String(l["id"])]));
  dayByLessonId = new Map(lessons.map((l) => [String(l["id"]), Number(l["day"])]));
  missionIdBySlug = new Map(weekly.map((m) => [String(m["slug"]), String(m["id"])]));
  slugByMissionId = new Map(weekly.map((m) => [String(m["id"]), String(m["slug"])]));
  // Perguntas só são lidas pela função (a tabela é restrita); uma chamada por lição publicada.
  const questionLists = await Promise.all(
    lessons.map(async (l) => {
      const { data } = await db.rpc("get_lesson_questions", { p_lesson: l["id"] });
      return ((data ?? []) as { id: string; position: number }[]).map((q) => ({ ...q, day: Number(l["day"]) }));
    }),
  );
  questionIdByKey = new Map(questionLists.flat().map((q) => [`${q.day}-${q.position}`, q.id]));
  keyByQuestionId = new Map(questionLists.flat().map((q) => [q.id, `${q.day}-${q.position}`]));

  const plan = (plans.find((p) => p["is_primary"]) ?? plans[0]) as Record<string, unknown> | undefined;
  planId = plan ? String(plan["id"]) : null;
  const base = emptyState();
  const p = (profile ?? {}) as Record<string, unknown>;
  const s: DemoState = {
    ...base,
    profile: {
      displayName: (p["display_name"] as string) ?? "",
      birthYear: num(p["birth_year"]),
      workType: (p["work_type"] as Profile["workType"]) ?? null,
      hasOverdueDebt: (p["has_overdue_debt"] as boolean | null) ?? null,
      emergencyFundReady: !!p["emergency_fund_ready"],
      monthlyReminder: p["monthly_reminder"] !== false,
      reminderDay: Number(p["reminder_day"] ?? 5),
      weeklyReminder: p["weekly_reminder"] !== false,
      analyticsConsent: !!p["analytics_consent"],
      onboardingCompletedAt: (p["onboarding_completed_at"] as string) ?? null,
      goalRetirementAge: num(p["goal_retirement_age"]),
      goalIncome: num(p["goal_income"]),
      hideValues: p["hide_values"] !== false,
      objective: (p["objective"] as Profile["objective"]) ?? null,
      reviewCadence: (p["review_cadence"] as Profile["reviewCadence"]) ?? "trimestral",
      missingFields: (p["missing_fields"] as Profile["missingFields"]) ?? [],
    },
    plan: plan
      ? {
          id: String(plan["id"]),
          createdAt: String(plan["created_at"]),
          updatedAt: String(plan["updated_at"]),
          inputs: {
            currentAge: Number(plan["current_age"]),
            retirementAge: Number(plan["retirement_age"]),
            horizonAge: Number(plan["horizon_age"]),
            initialWealth: Number(plan["initial_wealth"]),
            monthlyContribution: Number(plan["monthly_contribution"]),
            desiredMonthlyIncome: Number(plan["desired_monthly_income"]),
            inssEstimate: num(plan["inss_estimate"]),
            returns: {
              conservador: Number(plan["return_conservative"]),
              central: Number(plan["return_central"]),
              otimista: Number(plan["return_optimistic"]),
            },
            inflationAA: Number(plan["inflation_aa"]),
            costsAA: Number(plan["costs_aa"]),
          },
        }
      : null,
    snapshots: snapshots.map((x) => {
      const outputs = (x["outputs"] ?? {}) as { requiredCentralSemInss?: number; lifeReason?: string };
      return {
        id: String(x["id"]),
        reason: x["reason"] as DemoState["snapshots"][number]["reason"],
        lifeReason: outputs.lifeReason,
        createdAt: String(x["created_at"]),
        engineVersion: String(x["engine_version"]),
        inputs: x["inputs"] as PlanInputs,
        requiredCentralSemInss: Number(outputs.requiredCentralSemInss ?? 0),
      };
    }),
    contributions: contributions.map(
      (c): Contribution => ({
        id: String(c["id"]),
        month: String(c["month"]),
        made: !!c["made_contribution"],
        amount: num(c["amount"]),
        destination: (c["destination"] as Contribution["destination"]) ?? null,
        note: (c["note"] as string) ?? null,
        createdAt: String(c["created_at"]),
      }),
    ),
    wealthEntries: wealth.map(
      (w): WealthEntry => ({
        id: String(w["id"]),
        month: String(w["month"]),
        total: Number(w["total"]),
        previdencia: num(w["previdencia"]),
        note: (w["note"] as string) ?? null,
        breakdown: (w["breakdown"] as WealthEntry["breakdown"]) ?? null,
        createdAt: String(w["created_at"]),
      }),
    ),
    goals: goals.map(
      (g): Goal => ({
        id: String(g["id"]),
        title: String(g["title"]),
        kind: g["kind"] as Goal["kind"],
        target: num(g["target"]),
        deadline: (g["deadline"] as string) ?? null,
        createdAt: String(g["created_at"]),
        completedAt: (g["completed_at"] as string) ?? null,
      }),
    ),
    challenges: userChallenges.map((c) => ({
      slug: String(c["challenge_slug"]),
      startedAt: String(c["started_at"]),
      completedAt: (c["completed_at"] as string) ?? null,
    })),
    assets: assets.map(
      (a): Asset => ({
        id: String(a["id"]),
        name: String(a["name"]),
        category: a["category"] as Asset["category"],
        value: Number(a["value"]),
        forRetirement: !!a["for_retirement"],
        note: (a["note"] as string) ?? null,
        source: "manual",
        updatedAt: String(a["updated_at"]),
      }),
    ),
    assetValuations: valuations.map((v) => ({
      assetId: String(v["asset_id"]),
      month: String(v["month"]),
      value: Number(v["value"]),
      at: String(v["created_at"]),
    })),
    accounts: accounts.map(
      (a): Account => ({
        id: String(a["id"]),
        name: String(a["name"]),
        kind: a["kind"] as Account["kind"],
        openingBalance: Number(a["opening_balance"]),
        createdAt: String(a["created_at"]),
      }),
    ),
    categories: categories.map((c): Category => ({ id: String(c["id"]), name: String(c["name"]), kind: c["kind"] as Category["kind"] })),
    transactions: transactions.map(
      (t): Transaction => ({
        id: String(t["id"]),
        accountId: String(t["account_id"]),
        date: String(t["date"]),
        amount: Number(t["amount"]),
        payee: String(t["payee"]),
        categoryId: (t["category_id"] as string) ?? null,
        note: (t["note"] as string) ?? null,
        transferId: (t["transfer_id"] as string) ?? null,
        importedId: (t["imported_id"] as string) ?? null,
        source: t["source"] as Transaction["source"],
        recurringId: (t["recurring_id"] as string) ?? null,
        occurrenceDate: (t["occurrence_date"] as string) ?? null,
        contributionId: (t["contribution_id"] as string) ?? null,
        createdAt: String(t["created_at"]),
      }),
    ),
    recurring: recurring.map(
      (r): RecurringRule => ({
        id: String(r["id"]),
        accountId: String(r["account_id"]),
        amount: Number(r["amount"]),
        payee: String(r["payee"]),
        categoryId: (r["category_id"] as string) ?? null,
        note: (r["note"] as string) ?? null,
        startDate: String(r["start_date"]),
        frequency: r["frequency"] as RecurringRule["frequency"],
        interval: Number(r["every"]),
        endDate: (r["end_date"] as string) ?? null,
        weekend: r["weekend"] as RecurringRule["weekend"],
        active: !!r["active"],
      }),
    ),
    categoryRules: categoryRules.map(
      (r): CategoryRule => ({
        id: String(r["id"]),
        op: r["op"] as CategoryRule["op"],
        value: String(r["value"]),
        categoryId: String(r["category_id"]),
        renameTo: (r["rename_to"] as string) ?? null,
      }),
    ),
    budget: {
      assigned: assignments.reduce<Record<string, Record<string, number>>>((acc, a) => {
        const m = String(a["month"]);
        (acc[m] ??= {})[String(a["envelope"])] = Number(a["amount"]);
        return acc;
      }, {}),
      templates: templates.map(
        (t): BudgetTemplate => ({
          envelopeId: String(t["envelope"]),
          kind: t["kind"] as BudgetTemplate["kind"],
          amount: num(t["amount"]),
          target: num(t["target"]),
          deadline: (t["deadline"] as string) ?? null,
          percent: num(t["percent"]),
        }),
      ),
    },
    holdings: holdings.map(
      (h): Holding => ({
        id: String(h["id"]),
        assetId: String(h["asset_id"]),
        name: String(h["name"]),
        assetClass: h["asset_class"] as AssetClass,
        price: Number(h["price"]),
        priceUpdatedAt: String(h["price_updated_at"]),
      }),
    ),
    trades: trades.map(
      (t): PortfolioTrade => ({
        id: String(t["id"]),
        holdingId: String(t["holding_id"]),
        date: String(t["date"]),
        type: t["type"] as PortfolioTrade["type"],
        quantity: Number(t["quantity"]),
        unitPrice: Number(t["unit_price"]),
        fees: Number(t["fees"]),
      }),
    ),
    allocationTargets: Object.fromEntries(targets.map((t) => [String(t["asset_class"]), Number(t["percent"])])) as DemoState["allocationTargets"],
    xpEvents: xp.map((e) => ({
      action: e["action_type"] as DemoState["xpEvents"][number]["action"],
      periodKey: String(e["period_key"]),
      xp: Number(e["xp"]),
      at: String(e["created_at"]),
    })),
    stats: stats
      ? {
          totalXp: Number((stats as Record<string, unknown>)["total_xp"] ?? 0),
          level: Number((stats as Record<string, unknown>)["level"] ?? 1),
          weekStreak: Number((stats as Record<string, unknown>)["week_streak"] ?? 0),
          bestWeekStreak: Number((stats as Record<string, unknown>)["best_week_streak"] ?? 0),
          dayStreak: Number((stats as Record<string, unknown>)["day_streak"] ?? 0),
          bestDayStreak: Number((stats as Record<string, unknown>)["best_day_streak"] ?? 0),
        }
      : base.stats,
    achievements: achievements.map((a) => ({ code: a["achievement_code"] as DemoState["achievements"][number]["code"], at: String(a["earned_at"]) })),
    weeks: weeks.map((w) => ({ weekStart: String(w["week_start"]), status: w["status"] as DemoState["weeks"][number]["status"] })),
    days: days.map((d) => String(d["day"])),
    lessonCompletions: Object.fromEntries(
      lessonDone.flatMap((l) => {
        const day = dayByLessonId.get(String(l["lesson_id"]));
        return day ? [[day, String(l["completed_at"])]] : [];
      }),
    ),
    answers: Object.fromEntries(
      answers.flatMap((a) => {
        const key = keyByQuestionId.get(String(a["question_id"]));
        return key ? [[key, { selected: String(a["selected_option"]), correct: !!a["is_correct"] }]] : [];
      }),
    ),
    missionCompletions: missions.map((m) => ({
      isoWeek: String(m["iso_week"]),
      slug: slugByMissionId.get(String(m["mission_id"])) ?? String(m["mission_id"]),
      at: String(m["completed_at"]),
    })),
    journey: {
      testedOutUnits: ((program as Record<string, unknown> | null)?.["tested_out_units"] as number[] | undefined) ?? [],
      dailyMissions: daily.map((d) => ({ day: String(d["day"]), kind: d["kind"] as DemoState["journey"]["dailyMissions"][number]["kind"], at: String(d["completed_at"]) })),
    },
    program: program
      ? {
          currentDay: Number((program as Record<string, unknown>)["current_day"] ?? 1),
          startedAt: String((program as Record<string, unknown>)["started_at"]),
          completedAt: ((program as Record<string, unknown>)["completed_at"] as string) ?? null,
        }
      : base.program,
  };
  setStatus({ isAdmin: roles.some((r) => r["role"] === "admin") });
  return s;
}

// ---------- Gravar: diferença entre o antes e o depois, nas tabelas que aceitam escrita direta ----------
type Spec<T> = {
  table: string;
  items: (s: DemoState) => T[];
  key: (t: T) => string;
  row: (t: T, userId: string) => Record<string, unknown>;
  ops: ("insert" | "update" | "delete")[];
  /** Coluna usada para localizar a linha (padrão: id). */
  match?: (t: T) => Record<string, unknown>;
};

const accountsSpec: Spec<Account> = {
  table: "accounts",
  items: (s) => s.accounts,
  key: (a) => a.id,
  row: (a, user_id) => ({ id: a.id, user_id, name: a.name, kind: a.kind, opening_balance: a.openingBalance }),
  ops: ["insert", "update", "delete"],
};
const categoriesSpec: Spec<Category> = {
  table: "categories",
  items: (s) => s.categories,
  key: (c) => c.id,
  row: (c, user_id) => ({ id: c.id, user_id, name: c.name, kind: c.kind }),
  ops: ["insert", "update", "delete"],
};
const recurringSpec: Spec<RecurringRule> = {
  table: "recurring_rules",
  items: (s) => s.recurring,
  key: (r) => r.id,
  row: (r, user_id) => ({
    id: r.id,
    user_id,
    account_id: r.accountId,
    amount: r.amount,
    payee: r.payee,
    category_id: r.categoryId,
    note: r.note,
    start_date: r.startDate,
    frequency: r.frequency,
    every: r.interval,
    end_date: r.endDate,
    weekend: r.weekend,
    active: r.active,
  }),
  ops: ["insert", "update", "delete"],
};
const transactionsSpec: Spec<Transaction> = {
  table: "transactions",
  items: (s) => s.transactions,
  key: (t) => t.id,
  row: (t, user_id) => ({
    id: t.id,
    user_id,
    account_id: t.accountId,
    date: t.date,
    amount: t.amount,
    payee: t.payee,
    category_id: t.categoryId,
    note: t.note,
    transfer_id: t.transferId,
    imported_id: t.importedId,
    source: t.source,
    recurring_id: t.recurringId,
    occurrence_date: t.occurrenceDate,
    contribution_id: t.contributionId,
  }),
  ops: ["insert", "update", "delete"],
};
const categoryRulesSpec: Spec<CategoryRule> = {
  table: "category_rules",
  items: (s) => s.categoryRules,
  key: (r) => r.id,
  row: (r, user_id) => ({ id: r.id, user_id, op: r.op, value: r.value, category_id: r.categoryId, rename_to: r.renameTo }),
  ops: ["insert", "update", "delete"],
};
const templatesSpec: Spec<BudgetTemplate> = {
  table: "budget_templates",
  items: (s) => s.budget.templates,
  key: (t) => t.envelopeId,
  row: (t, user_id) => ({ user_id, envelope: t.envelopeId, kind: t.kind, amount: t.amount, target: t.target, deadline: t.deadline, percent: t.percent }),
  ops: ["insert", "update", "delete"],
  match: (t) => ({ envelope: t.envelopeId }),
};
type Assignment = { month: string; envelope: string; amount: number };
const assignmentsSpec: Spec<Assignment> = {
  table: "budget_assignments",
  items: (s) => Object.entries(s.budget.assigned).flatMap(([month, m]) => Object.entries(m).map(([envelope, amount]) => ({ month, envelope, amount }))),
  key: (a) => `${a.month}|${a.envelope}`,
  row: (a, user_id) => ({ user_id, month: a.month, envelope: a.envelope, amount: a.amount }),
  ops: ["insert", "update", "delete"],
  match: (a) => ({ month: a.month, envelope: a.envelope }),
};
const holdingsSpec: Spec<Holding> = {
  table: "holdings",
  items: (s) => s.holdings,
  key: (h) => h.id,
  row: (h, user_id) => ({ id: h.id, user_id, asset_id: h.assetId, name: h.name, asset_class: h.assetClass, price: h.price }),
  ops: ["insert", "update", "delete"],
};
const tradesSpec: Spec<PortfolioTrade> = {
  table: "trades",
  items: (s) => s.trades,
  key: (t) => t.id,
  row: (t, user_id) => ({ id: t.id, user_id, holding_id: t.holdingId, date: t.date, type: t.type, quantity: t.quantity, unit_price: t.unitPrice, fees: t.fees }),
  ops: ["insert", "delete"],
};
const contributionsSpec: Spec<Contribution> = {
  table: "contributions",
  items: (s) => s.contributions,
  key: (c) => c.id,
  row: (c) => ({ amount: c.amount, destination: c.destination, note: c.note }),
  ops: ["update", "delete"],
};
const wealthSpec: Spec<WealthEntry> = {
  table: "wealth_entries",
  items: (s) => s.wealthEntries,
  key: (w) => w.id,
  row: (w) => ({ total: w.total, previdencia: w.previdencia, note: w.note }),
  ops: ["update", "delete"],
};
const goalsSpec: Spec<Goal> = { table: "goals", items: (s) => s.goals, key: (g) => g.id, row: () => ({}), ops: ["delete"] };
const assetsSpec: Spec<Asset> = { table: "assets", items: (s) => s.assets, key: (a) => a.id, row: () => ({}), ops: ["delete"] };
type ChallengeRun = DemoState["challenges"][number];
const challengesSpec: Spec<ChallengeRun> = {
  table: "user_challenges",
  items: (s) => s.challenges.filter((c) => !c.completedAt),
  key: (c) => `${c.slug}|${c.startedAt}`,
  row: () => ({}),
  ops: ["delete"],
  match: (c) => ({ challenge_slug: c.slug }),
};

/** Ordem de gravação: quem é referenciado vem antes (e é apagado depois). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ORDER: Spec<any>[] = [
  accountsSpec,
  categoriesSpec,
  recurringSpec,
  transactionsSpec,
  categoryRulesSpec,
  templatesSpec,
  assignmentsSpec,
  holdingsSpec,
  tradesSpec,
  contributionsSpec,
  wealthSpec,
  goalsSpec,
  challengesSpec,
  assetsSpec,
];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function applyDiff(prev: DemoState, next: DemoState, userId: string, only?: Spec<unknown>[]) {
  const specs = only ?? ORDER;
  // Perfil: só as colunas que mudaram.
  if (!only) await applyProfileDiff(prev.profile, next.profile, userId);
  const plans = specs.map((spec) => {
    const before = new Map(spec.items(prev).map((t) => [spec.key(t), t]));
    const after = new Map(spec.items(next).map((t) => [spec.key(t), t]));
    const inserts = [...after].filter(([k]) => !before.has(k)).map(([, t]) => t);
    const updates = [...after].filter(([k, t]) => before.has(k) && !same(before.get(k), t)).map(([, t]) => t);
    const deletes = [...before].filter(([k]) => !after.has(k)).map(([, t]) => t);
    return { spec, inserts, updates, deletes };
  });
  for (const { spec, inserts, updates } of plans) {
    const where = (t: unknown) => spec.match?.(t) ?? { id: spec.key(t) };
    if (spec.ops.includes("insert") && inserts.length) await must(db.from(spec.table).insert(inserts.map((t) => spec.row(t, userId))));
    if (spec.ops.includes("update"))
      for (const t of updates) {
        const { id: _id, user_id: _u, ...patch } = spec.row(t, userId);
        await must(db.from(spec.table).update(patch).match(where(t)));
      }
  }
  for (const { spec, deletes } of [...plans].reverse()) {
    if (!spec.ops.includes("delete")) continue;
    for (const t of deletes) await must(db.from(spec.table).delete().match(spec.match?.(t) ?? { id: spec.key(t) }));
  }
}

const PROFILE_COLUMNS: Record<keyof Profile, string> = {
  displayName: "display_name",
  birthYear: "birth_year",
  workType: "work_type",
  hasOverdueDebt: "has_overdue_debt",
  emergencyFundReady: "emergency_fund_ready",
  monthlyReminder: "monthly_reminder",
  reminderDay: "reminder_day",
  weeklyReminder: "weekly_reminder",
  analyticsConsent: "analytics_consent",
  onboardingCompletedAt: "onboarding_completed_at",
  goalRetirementAge: "goal_retirement_age",
  goalIncome: "goal_income",
  hideValues: "hide_values",
  objective: "objective",
  reviewCadence: "review_cadence",
  missingFields: "missing_fields",
};
async function applyProfileDiff(prev: Profile, next: Profile, userId: string) {
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(PROFILE_COLUMNS) as (keyof Profile)[]) if (!same(prev[k], next[k])) patch[PROFILE_COLUMNS[k]] = next[k];
  if (!k(patch)) return;
  const { error } = await db.from("profiles").update(patch).eq("id", userId);
  if (!error) return;
  // Sem a migração 20261028120000_conta (colunas goal_*), grava o resto em vez de travar o onboarding.
  if (/goal_(retirement_age|income)/.test(error.message)) {
    const { goal_retirement_age: _a, goal_income: _b, ...rest } = patch;
    if (k(rest)) await must(db.from("profiles").update(rest).eq("id", userId));
    return;
  }
  throw new Error(error.message);
}
const k = (o: object) => Object.keys(o).length > 0;

/** Com operações de investimento, o valor do item vem das posições: grava o valor calculado aqui. */
async function syncAssetValues(prev: DemoState, next: DemoState) {
  for (const a of next.assets) {
    if (!valuedByHoldings(next, a.id)) continue;
    const before = prev.assets.find((x) => x.id === a.id)?.value;
    const value = holdingsValue(next, a.id) / 100;
    if (before !== value || !valuedByHoldings(prev, a.id)) await must(db.rpc("set_asset_value_from_holdings", { p_asset: a.id, p_value: value }));
  }
}

// ---------- Gravar: operações com regra no servidor (RPC) ----------
type Handler = (args: unknown[], prev: DemoState, next: DemoState, userId: string) => Promise<void>;
const rpc = (fn: string, params?: Record<string, unknown>) => must(db.rpc(fn, params));
const lesson = (day: number) => {
  const id = lessonIdByDay.get(day);
  if (!id) throw new Error("Esta lição ainda não foi publicada.");
  return id;
};

const HANDLERS: Record<string, Handler> = {
  // Só deste aparelho: no modo nuvem, o recarregamento devolve o que está no banco.
  reset: async () => {},
  startFresh: async () => {},
  updateProfile: async (_a, prev, next, user) => applyProfileDiff(prev.profile, next.profile, user),
  setEmergencyFund: async (_a, prev, next, user) => {
    await applyProfileDiff(prev.profile, next.profile, user);
    await rpc("get_my_progress");
  },
  answerQuestion: async ([day, position, selected]) => {
    const key = `${day as number}-${position as number}`;
    const id = questionIdByKey.get(key);
    if (!id) throw new Error("Esta pergunta ainda não foi publicada.");
    await rpc("answer_question", { p_question: id, p_option: selected });
  },
  completeLesson: async ([day]) => {
    await rpc("complete_lesson", { p_lesson: lesson(day as number) });
  },
  submitPlacement: async ([unit, answers]) => {
    await rpc("submit_placement", { p_unit: unit, p_answers: answers });
  },
  completeDailyMission: async ([kind, answers]) => {
    // A lição do dia já conta a missão "aprender" dentro de complete_lesson.
    if (kind === "learn") return;
    await rpc("complete_daily_mission", { p_kind: kind, p_answers: answers ?? null });
  },
  completeMission: async ([slug]) => {
    const id = missionIdBySlug.get(slug as string);
    if (!id) throw new Error("Esta missão ainda não foi publicada.");
    await rpc("complete_weekly_mission", { p_mission: id });
  },
  savePlan: async ([inputs, , lifeReason], prev, next, user) => {
    const i = inputs as PlanInputs;
    const row = {
      user_id: user,
      current_age: i.currentAge,
      retirement_age: i.retirementAge,
      horizon_age: i.horizonAge,
      initial_wealth: i.initialWealth,
      monthly_contribution: i.monthlyContribution,
      desired_monthly_income: i.desiredMonthlyIncome,
      inss_estimate: i.inssEstimate,
      return_conservative: i.returns.conservador,
      return_central: i.returns.central,
      return_optimistic: i.returns.otimista,
      inflation_aa: i.inflationAA,
      costs_aa: i.costsAA,
    };
    if (planId) await must(db.from("retirement_plans").update(row).eq("id", planId));
    else planId = String((await must<{ id: string }>(db.from("retirement_plans").insert({ ...row, is_primary: true }).select("id").single())).id);
    const snap = next.snapshots[0]!;
    await rpc("record_plan_event", {
      p_plan: planId,
      p_reason: snap.reason,
      p_engine_version: ENGINE_VERSION,
      p_inputs: i,
      p_outputs: { requiredCentralSemInss: snap.requiredCentralSemInss, lifeReason: lifeReason ?? null },
    });
    await applyProfileDiff(prev.profile, next.profile, user);
  },
  logContribution: async ([input]) => {
    const c = input as { month: string; made: boolean; amount?: number | null; destination?: string | null; note?: string | null };
    await rpc("log_contribution", { p_month: c.month, p_made: c.made, p_amount: c.made ? (c.amount ?? null) : null, p_destination: c.destination ?? null, p_note: c.note ?? null });
  },
  logWealth: async ([input]) => {
    const w = input as { month: string; total: number; previdencia?: number | null; note?: string | null };
    await rpc("log_wealth", { p_month: w.month, p_total: w.total, p_previdencia: w.previdencia ?? null, p_note: w.note ?? null, p_breakdown: null });
  },
  logWealthFromAssets: async ([note]) => {
    await rpc("log_wealth_from_assets", { p_note: (note as string | null | undefined) ?? null });
  },
  saveAsset: async ([input], _prev, next) => {
    const a = input as { id?: string; name: string; category: string; forRetirement: boolean; note?: string | null };
    const saved = a.id ? next.assets.find((x) => x.id === a.id) : next.assets.at(-1);
    await rpc("upsert_asset", {
      p_name: a.name,
      p_category: a.category,
      p_value: saved?.value ?? 0,
      p_for_retirement: a.forRetirement,
      p_note: a.note ?? null,
      p_id: a.id ?? null,
    });
  },
  setAllocationTargets: async (_a, _prev, next) => {
    await rpc("set_allocation_targets", { p_targets: next.allocationTargets });
  },
  createGoal: async ([input]) => {
    const g = input as { title: string; kind: string; target?: number | null; deadline?: string | null };
    await rpc("create_goal", { p_title: g.title, p_kind: g.kind, p_target: g.kind === "valor" ? (g.target ?? null) : null, p_deadline: g.deadline ?? null });
  },
  completeGoal: async ([id]) => {
    await rpc("complete_goal", { p_goal: id });
  },
  startChallenge: async ([slug]) => {
    await rpc("start_challenge", { p_slug: slug });
  },
  addTransfer: async ([input]) => {
    const t = input as { fromId: string; toId: string; date: string; amount: number; note?: string | null; contribution?: string | null };
    await rpc("create_transfer", { p_from: t.fromId, p_to: t.toId, p_date: t.date, p_amount: t.amount, p_note: t.note ?? null, p_contribution: t.contribution ?? null });
  },
  importTransactions: async ([accountId], prev, next) => {
    const before = new Map(prev.transactions.map((t) => [t.id, t]));
    const fresh = next.transactions
      .filter((t) => !before.has(t.id) && t.accountId === accountId)
      .map((t) => ({ date: t.date, amount: t.amount, payee: t.payee, categoryId: t.categoryId ?? "", memo: t.note, importedId: t.importedId }));
    const matched = next.transactions
      .filter((t) => before.has(t.id) && before.get(t.id)!.importedId !== t.importedId)
      .map((t) => ({ existingId: t.id, importedId: t.importedId }));
    await rpc("import_transactions", { p_account: accountId, p_fresh: fresh, p_matched: matched });
  },
  // Recorrências: a regra vai direto para a tabela; quem lança as ocorrências é o banco (materialize_recurring).
  saveRecurring: async (_a, prev, next, user) => {
    await applyDiff(prev, next, user, [recurringSpec as Spec<unknown>]);
    await rpc("materialize_recurring");
  },
  runRecurring: async () => {
    await rpc("materialize_recurring");
  },
  moveBudget: async ([month, fromId, toId, amount]) => {
    await rpc("move_budget", { p_month: month, p_from: fromId, p_to: toId, p_amount: amount });
  },
  closeMonth: async () => {
    await rpc("complete_month_close");
  },
};

// ---------- Fila ----------
let queue: Promise<void> = Promise.resolve();
let pending = 0;

/** Recebe cada operação feita nas telas (ligado em useBackend("cloud", ...)). */
export function enqueue(op: string, args: unknown[], prev: DemoState, next: DemoState) {
  const userId = status.userId;
  if (!userId) return;
  pending++;
  setStatus({ syncing: true });
  queue = queue
    .then(async () => {
      const handler = HANDLERS[op];
      if (handler) await handler(args, prev, next, userId);
      else await applyDiff(prev, next, userId);
      // Operações em posições e operações mudam o valor do item do Patrimônio.
      if (["saveHolding", "deleteHolding", "addTrade", "deleteTrade"].includes(op)) await syncAssetValues(prev, next);
    })
    .catch((e: unknown) => {
      toast.error(`Não foi possível salvar: ${(e as Error).message}`);
    })
    .finally(async () => {
      pending--;
      // Recarrega do banco só com a fila vazia, para não apagar da tela uma operação que ainda vai ser gravada.
      if (pending === 0) await reload();
    });
}

/** Lê tudo do banco de novo e troca o estado das telas. */
export async function reload() {
  const userId = status.userId;
  if (!userId) return;
  try {
    const s = await loadAll(userId);
    if (pending === 0 && status.userId === userId) replaceState(s);
    setStatus({ syncing: false, loaded: true, error: null });
  } catch (e) {
    setStatus({ syncing: false, error: (e as Error).message });
    toast.error("Não foi possível carregar seus dados. Confira a conexão e tente de novo.");
  }
}

/** Entra no modo nuvem para a conta. */
export async function startCloud(userId: string) {
  if (status.userId === userId) return;
  setStatus({ userId, loaded: false, syncing: true, error: null, isAdmin: false });
  identify(userId);
  useBackend("cloud", enqueue);
  await reload();
}

/** Sai do modo nuvem (logout): o estado em memória some. */
export function stopCloud() {
  if (!status.userId) return;
  planId = null;
  setStatus({ userId: null, loaded: false, syncing: false, isAdmin: false, error: null });
  useBackend("demo");
}

/** O estado atual, para depuração. */
export const cloudSnapshot = () => getState();
