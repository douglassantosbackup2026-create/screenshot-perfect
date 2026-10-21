// Tipos e constantes do estado do app (mesma forma das tabelas do banco). Sem lógica.
import { type PlanInputs } from "@/lib/calc/retirement";
import { type AssetCategory } from "@/lib/calc/assets";
import { type BreakdownItem } from "@/lib/calc/networth";
import { type AccountKind } from "@/lib/calc/ledger";
import { type BudgetTemplate } from "@/lib/calc/budget";
import { type RecurrenceRule } from "@/lib/calc/recurring";
import { type CategoryRule } from "@/lib/calc/categorize";
import { type AssetClass, type Trade } from "@/lib/calc/portfolio";
import { type AchievementCode, type WeekRecord, type XpEvent } from "@/lib/gamification/rules";
import { type DailyKind } from "@/lib/journey/journey";

export type WorkType = "pj" | "autonomo" | "mei" | "clt" | "servidor" | "outro";
export type Destination = "previdencia" | "investimentos" | "reserva" | "outro";
export type SnapshotReason = "created" | "edit" | "quick_review" | "life_event" | "annual_review";
export type Objective = "entender" | "organizar" | "previdencia";
export type ReviewCadence = "mensal" | "trimestral" | "semestral";
/** Dados que a pessoa pulou ou ainda não informou; aparecem como aviso, nunca são inventados. */
export type MissingField = "idade" | "renda" | "patrimonio" | "aporte";

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
  /** Privacidade por padrão: valores aparecem ocultos até a pessoa pedir para ver. */
  hideValues: boolean;
  objective: Objective | null;
  reviewCadence: ReviewCadence;
  missingFields: MissingField[];
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

/** Foto do patrimônio em um mês (o último registro do mês vale). */
export type WealthEntry = {
  id: string;
  month: string;
  total: number;
  previdencia: number | null;
  note: string | null;
  /** Itens que compõem o total, quando o registro foi montado a partir do Patrimônio. */
  breakdown: BreakdownItem[] | null;
  createdAt: string;
};
export type GoalKind = "valor" | "habito";
export type Goal = {
  id: string;
  title: string;
  kind: GoalKind;
  target: number | null;
  deadline: string | null;
  createdAt: string;
  completedAt: string | null;
};
export type ChallengeRun = { slug: string; startedAt: string; completedAt: string | null };
/** Item do patrimônio informado pela pessoa (espelho de public.assets). */
export type Asset = {
  id: string;
  name: string;
  category: AssetCategory;
  value: number;
  forRetirement: boolean;
  note: string | null;
  source: "manual";
  updatedAt: string;
};
/** Valor de um item em um mês (espelho de public.asset_valuations); o último registro do mês vale. */
export type AssetValuation = { assetId: string; month: string; value: number; at: string };

// ---------- Livro-caixa (valores em centavos, com sinal) ----------
export type Account = {
  id: string;
  name: string;
  kind: AccountKind;
  openingBalance: number;
  createdAt: string;
  /** Item do Patrimônio que esta conta representa (previdência ou investimentos): o valor do item é o saldo da conta. */
  assetId: string | null;
};
export type CategoryKind = "receita" | "despesa";
export type Category = { id: string; name: string; kind: CategoryKind };
export type TxSource = "manual" | "importado" | "recorrente";
export type Transaction = {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  payee: string;
  categoryId: string | null;
  note: string | null;
  /** Outra perna da transferência; transferências não têm categoria. */
  transferId: string | null;
  importedId: string | null;
  source: TxSource;
  recurringId: string | null;
  occurrenceDate: string | null;
  /** Aporte do Diário criado junto com esta transferência. */
  contributionId: string | null;
  createdAt: string;
};
export type RecurringRule = RecurrenceRule & {
  id: string;
  accountId: string;
  amount: number;
  payee: string;
  categoryId: string | null;
  note: string | null;
  active: boolean;
};

/** Categorias iniciais; a pessoa pode criar outras. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: "cat-renda", name: "Renda do trabalho", kind: "receita" },
  { id: "cat-outras-receitas", name: "Outras receitas", kind: "receita" },
  { id: "cat-moradia", name: "Moradia", kind: "despesa" },
  { id: "cat-mercado", name: "Mercado", kind: "despesa" },
  { id: "cat-transporte", name: "Transporte", kind: "despesa" },
  { id: "cat-saude", name: "Saúde", kind: "despesa" },
  { id: "cat-educacao", name: "Educação", kind: "despesa" },
  { id: "cat-restaurantes", name: "Restaurantes", kind: "despesa" },
  { id: "cat-lazer", name: "Lazer", kind: "despesa" },
  { id: "cat-assinaturas", name: "Assinaturas", kind: "despesa" },
  { id: "cat-impostos", name: "Impostos e taxas", kind: "despesa" },
  { id: "cat-outros", name: "Outros gastos", kind: "despesa" },
];

export type DailyMissionRecord = { day: string; kind: DailyKind; at: string };
export type Journey = {
  /** Unidades liberadas pelo teste de nivelamento (as lições ficam abertas, não concluídas). */
  testedOutUnits: number[];
  dailyMissions: DailyMissionRecord[];
};

// ---------- Investimentos (centavos; quantidades com fração) ----------
/** Posição dentro de um item do Patrimônio. O preço atual é informado pela pessoa. */
export type Holding = { id: string; assetId: string; name: string; assetClass: AssetClass; price: number; priceUpdatedAt: string };
export type PortfolioTrade = Trade & { holdingId: string };

/** Orçamento por envelopes: quanto foi distribuído em cada mês ("YYYY-MM-01") e envelope, em centavos. */
export type Budget = { assigned: Record<string, Record<string, number>>; templates: BudgetTemplate[] };

export type DemoState = {
  version: 8;
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
  wealthEntries: WealthEntry[];
  goals: Goal[];
  challenges: ChallengeRun[];
  assets: Asset[];
  assetValuations: AssetValuation[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: RecurringRule[];
  categoryRules: CategoryRule[];
  budget: Budget;
  holdings: Holding[];
  trades: PortfolioTrade[];
  /** Metas de alocação por classe, em %, somando 100. */
  allocationTargets: Partial<Record<AssetClass, number>>;
  journey: Journey;
  /** Dias ativos ("YYYY-MM-DD", horário de Brasília) para a sequência diária. */
  days: string[];
  stats: Stats;
};
export type Stats = {
  totalXp: number;
  level: number;
  weekStreak: number;
  bestWeekStreak: number;
  dayStreak: number;
  bestDayStreak: number;
};
export const EMPTY_STATS: Stats = { totalXp: 0, level: 1, weekStreak: 0, bestWeekStreak: 0, dayStreak: 0, bestDayStreak: 0 };

/** Desafios em andamento ao mesmo tempo. */
export const MAX_ACTIVE_CHALLENGES = 2;

export type ActionResult = {
  xpAwarded: number;
  newAchievements: AchievementCode[];
  totalXp: number;
  level: number;
  weekStreak: number;
  dayStreak: number;
};

export const DEFAULT_ASSUMPTIONS = {
  horizonAge: 95,
  returns: { conservador: 0.02, central: 0.04, otimista: 0.06 },
  inflationAA: 0.04,
  costsAA: 0,
};

export type MonthStepKey = "lancamentos" | "categorias" | "orcamento" | "aporte" | "patrimonio";

export const CALC_PREFILL_KEY = "calc_prefill";
/** O que a pessoa já digitou na calculadora ou na landing, para o onboarding não perguntar de novo. */
export type CalcPrefill = {
  currentAge: number;
  retirementAge: number;
  desiredIncome: number;
  initialWealth?: number | null;
  monthlyContribution?: number | null;
  inssEstimate?: number | null;
};

/** Guarda (ou apaga, com null) o que veio da calculadora. Fica no aparelho: o link de confirmação do e-mail abre outra aba. */
export function setCalcPrefill(p: CalcPrefill | null) {
  try {
    if (p) localStorage.setItem(CALC_PREFILL_KEY, JSON.stringify(p));
    else localStorage.removeItem(CALC_PREFILL_KEY);
  } catch {
    /* armazenamento indisponível */
  }
}
