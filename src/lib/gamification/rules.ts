// Regras de gamificação (spec §8), espelhando as funções do banco (§6.1).
// Funções puras: recebem o estado e devolvem o novo estado. Nada aqui depende de valores em reais.

export type XpAction =
  | "lesson_completed"
  | "quiz_correct"
  | "weekly_mission"
  | "first_plan_created"
  | "contribution_logged"
  | "plan_quick_review"
  | "plan_life_event"
  | "program_completed"
  | "annual_review"
  | "wealth_logged"
  | "goal_created"
  | "goal_completed"
  | "challenge_completed"
  | "daily_mission"
  | "statement_imported"
  | "budget_planned"
  | "investment_logged";

export const XP: Record<XpAction, number> = {
  lesson_completed: 10,
  quiz_correct: 2,
  weekly_mission: 30,
  first_plan_created: 100,
  // Registrar o mês conta (inclusive "não aportei"); aportar mais nunca dá XP.
  contribution_logged: 20,
  plan_quick_review: 20,
  plan_life_event: 40,
  program_completed: 200,
  annual_review: 150,
  // Registrar informação conta; o valor registrado nunca muda o XP.
  wealth_logged: 30,
  goal_created: 20,
  goal_completed: 60,
  challenge_completed: 40,
  // Missão do dia: uma vez por dia, qualquer que seja o tipo.
  daily_mission: 10,
  // Uma vez por mês cada: importar extrato, planejar o orçamento do mês, registrar uma operação de investimento.
  // Como no resto, o XP vem do hábito; quanto entrou, foi orçado ou foi investido não muda nada.
  statement_imported: 20,
  budget_planned: 20,
  investment_logged: 20,
};

/** Metas criadas só dão XP até 3 vezes por mês (periodKey "G:YYYY-MM:<id>"). */
export const GOAL_CREATED_XP_PER_MONTH = 3;
export function goalCreatedPeriodKey(events: XpEvent[], month: string, goalId: string): string | null {
  const prefix = `G:${month.slice(0, 7)}:`;
  const used = events.filter((e) => e.action === "goal_created" && e.periodKey.startsWith(prefix)).length;
  return used < GOAL_CREATED_XP_PER_MONTH ? prefix + goalId : null;
}

export type XpEvent = { action: XpAction; periodKey: string; xp: number; at: string };
export type WeekStatus = "ativa" | "pausa";
export type WeekRecord = { weekStart: string; status: WeekStatus };

// ---------- Datas no horário de Brasília (UTC-3, sem horário de verão) ----------
const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

/** Data local de São Paulo como "YYYY-MM-DD". */
export function spDate(now: Date): string {
  const d = new Date(now.getTime() - SP_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
function parseDay(s: string): Date {
  const [y = 1970, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmtDay(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDay(d);
}
/** Segunda-feira da semana do dia informado. */
export function weekStartOf(day: string): string {
  const d = parseDay(day);
  const dow = (d.getUTCDay() + 6) % 7; // segunda = 0
  return addDays(day, -dow);
}
/** "YYYY-MM-01" do mês. */
export function monthOf(day: string): string {
  return day.slice(0, 7) + "-01";
}
export function addMonths(month: string, n: number): string {
  const d = parseDay(month);
  d.setUTCMonth(d.getUTCMonth() + n);
  return fmtDay(d).slice(0, 7) + "-01";
}
export function isoWeekKey(weekStart: string): string {
  const d = parseDay(weekStart);
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + 3);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${pad(week)}`;
}
export function quarterKey(day: string): string {
  const m = Number(day.slice(5, 7));
  return `${day.slice(0, 4)}-Q${Math.ceil(m / 3)}`;
}

// ---------- XP ----------
/** Concede XP uma única vez por (ação, período). */
export function awardXp(events: XpEvent[], action: XpAction, periodKey: string, at: string) {
  if (events.some((e) => e.action === action && e.periodKey === periodKey)) {
    return { events, awarded: 0 };
  }
  const xp = XP[action];
  return { events: [...events, { action, periodKey, xp, at }], awarded: xp };
}

// ---------- Sequência semanal ----------
/**
 * Conta semanas ativas seguidas. A semana atual sem atividade não quebra.
 * Uma semana vazia entre duas ativas vira pausa (no máximo uma por mês civil).
 */
export function computeStreak(weeks: WeekRecord[], today: string) {
  const map = new Map(weeks.map((w) => [w.weekStart, w.status]));
  const added: WeekRecord[] = [];
  let week = weekStartOf(today);
  if (map.get(week) !== "ativa") week = addDays(week, -7);
  let streak = 0;
  for (let guard = 0; guard < 520; guard++) {
    const status = map.get(week);
    if (status === "ativa") streak++;
    else if (status === "pausa") {
      // pausa não soma, mas não quebra
    } else if (
      streak > 0 &&
      map.get(addDays(week, -7)) === "ativa" &&
      ![...map.entries()].some(([ws, st]) => st === "pausa" && ws.slice(0, 7) === week.slice(0, 7))
    ) {
      map.set(week, "pausa");
      added.push({ weekStart: week, status: "pausa" });
    } else break;
    week = addDays(week, -7);
  }
  return { streak, weeks: [...weeks, ...added] };
}

// ---------- Sequência diária ----------
/** Dias sem atividade cobertos automaticamente por semana (segunda a domingo). */
export const PROTECTED_DAYS_PER_WEEK = 2;

/**
 * Conta dias ativos seguidos. Hoje sem atividade não quebra.
 * Até 2 dias vazios por semana são protegidos: não somam, mas não quebram.
 */
export function computeDayStreak(days: string[], today: string) {
  const active = new Set(days);
  const earliest = [...active].sort()[0];
  const protectedDays: string[] = [];
  const protectedPerWeek = new Map<string, number>();
  let pending: string[] = []; // proteções só valem se houver dia ativo antes delas
  let streak = 0;
  let day = active.has(today) ? today : addDays(today, -1);
  for (let guard = 0; earliest && day >= earliest && guard < 3660; guard++) {
    if (active.has(day)) {
      streak++;
      protectedDays.push(...pending);
      pending = [];
    } else {
      const ws = weekStartOf(day);
      const used = protectedPerWeek.get(ws) ?? 0;
      if (used >= PROTECTED_DAYS_PER_WEEK) break;
      protectedPerWeek.set(ws, used + 1);
      pending.push(day);
    }
    day = addDays(day, -1);
  }
  return { streak, protectedDays };
}

// ---------- Níveis ----------
// Níveis medem aprendizado e constância (XP), nunca patrimônio ou renda.
export const LEVELS = [
  { level: 1, name: "Iniciante", minXp: 0 },
  { level: 2, name: "Planejador", minXp: 100 },
  { level: 3, name: "Construtor", minXp: 300 },
  { level: 4, name: "Estrategista", minXp: 600 },
  { level: 5, name: "Mestre do plano", minXp: 1000 },
] as const;

/** Nível atual e quanto falta para o próximo (`next` é null no último nível). */
export function levelFromXp(totalXp: number) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (totalXp >= LEVELS[i]!.minXp) idx = i;
  const cur = LEVELS[idx]!;
  const nxt = LEVELS[idx + 1] ?? null;
  return { level: cur.level, name: cur.name, min: cur.minXp, next: nxt ? nxt.minXp : null };
}

// ---------- Conquistas ----------
export type AchievementCode =
  | "primeiro_plano"
  | "primeiro_aporte"
  | "tres_meses_seguidos"
  | "reserva_montada"
  | "plano_ajustado"
  | "programa_21_concluido"
  | "primeira_revisao_anual"
  | "primeiro_registro_patrimonio"
  | "primeira_meta"
  | "meta_concluida"
  | "revisao_trimestral"
  | "primeiro_desafio"
  | "diagnostico_inicial"
  | "primeiro_extrato"
  | "primeiro_orcamento"
  | "primeiro_investimento"
  | "carteira_com_metas";

export const ACHIEVEMENTS: { code: AchievementCode; title: string; description: string; icon: string }[] = [
  { code: "primeiro_plano", title: "Primeiro plano", description: "Você criou seu plano de aposentadoria.", icon: "map" },
  { code: "primeiro_aporte", title: "Primeiro mês registrado", description: "Seu fio da constância começou.", icon: "sprout" },
  { code: "tres_meses_seguidos", title: "Três meses de constância", description: "Você registrou três meses seguidos, com ou sem aporte.", icon: "calendar-check" },
  { code: "reserva_montada", title: "Reserva de emergência", description: "Você informou que sua reserva está montada.", icon: "shield" },
  { code: "plano_ajustado", title: "Plano ajustado", description: "Você revisou o plano depois de uma mudança de vida.", icon: "refresh-cw" },
  { code: "programa_21_concluido", title: "Jornada concluída", description: "Você concluiu as quatro unidades da jornada.", icon: "flag" },
  { code: "diagnostico_inicial", title: "Diagnóstico inicial", description: "Você concluiu a Unidade 1: conheceu sua realidade.", icon: "compass" },
  { code: "primeira_revisao_anual", title: "Primeira revisão anual", description: "Você fez a revisão completa do seu plano.", icon: "award" },
  { code: "primeiro_registro_patrimonio", title: "Primeiro registro", description: "Você registrou seu patrimônio pela primeira vez.", icon: "trending-up" },
  { code: "primeira_meta", title: "Primeira meta", description: "Você criou sua primeira meta.", icon: "target" },
  { code: "meta_concluida", title: "Meta concluída", description: "Você concluiu uma meta que definiu.", icon: "check-circle" },
  { code: "revisao_trimestral", title: "Revisão trimestral", description: "Patrimônio registrado nos três meses de um trimestre e plano revisado.", icon: "calendar-range" },
  { code: "primeiro_desafio", title: "Primeiro desafio", description: "Você concluiu um desafio pessoal.", icon: "mountain" },
  { code: "primeiro_extrato", title: "Extrato importado", description: "Você importou um extrato do banco para o Diário.", icon: "file-up" },
  { code: "primeiro_orcamento", title: "Mês planejado", description: "Você deu um destino ao dinheiro do mês no orçamento.", icon: "wallet" },
  { code: "primeiro_investimento", title: "Primeiro investimento", description: "Você registrou uma operação de investimento.", icon: "line-chart" },
  { code: "carteira_com_metas", title: "Carteira com metas", description: "Você definiu quanto quer em cada classe de investimento.", icon: "pie-chart" },
];

export function hasThreeConsecutiveMonths(monthKeys: string[]): boolean {
  const idx = [...new Set(monthKeys)]
    .map((k) => Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7)))
    .sort((a, b) => a - b);
  let run = 1;
  for (let i = 1; i < idx.length; i++) {
    run = idx[i] === (idx[i - 1] ?? NaN) + 1 ? run + 1 : 1;
    if (run >= 3) return true;
  }
  return false;
}

/** Algum trimestre civil com patrimônio registrado nos 3 meses e ao menos uma revisão do plano. */
export function hasFullQuarter(wealthMonthKeys: string[], reviewDays: string[]): boolean {
  const months = new Set(wealthMonthKeys.map((k) => k.slice(0, 7)));
  const reviewed = new Set(reviewDays.map(quarterKey));
  for (const q of reviewed) {
    const [y, n] = q.split("-Q");
    const first = (Number(n) - 1) * 3 + 1;
    if ([0, 1, 2].every((i) => months.has(`${y}-${pad(first + i)}`))) return true;
  }
  return false;
}

export function eligibleAchievements(s: {
  hasPlan: boolean;
  contributionMonthKeys: string[];
  emergencyFundReady: boolean;
  hasLifeEvent: boolean;
  programCompleted: boolean;
  hasAnnualReview: boolean;
  hasWealthEntry?: boolean;
  hasGoal?: boolean;
  hasCompletedGoal?: boolean;
  hasFullQuarter?: boolean;
  hasCompletedChallenge?: boolean;
  hasCompletedFirstUnit?: boolean;
  hasImportedStatement?: boolean;
  hasPlannedBudget?: boolean;
  hasInvestmentTrade?: boolean;
  hasAllocationTargets?: boolean;
}): AchievementCode[] {
  const out: AchievementCode[] = [];
  if (s.hasPlan) out.push("primeiro_plano");
  if (s.contributionMonthKeys.length >= 1) out.push("primeiro_aporte");
  if (hasThreeConsecutiveMonths(s.contributionMonthKeys)) out.push("tres_meses_seguidos");
  if (s.emergencyFundReady) out.push("reserva_montada");
  if (s.hasLifeEvent) out.push("plano_ajustado");
  if (s.programCompleted) out.push("programa_21_concluido");
  if (s.hasAnnualReview) out.push("primeira_revisao_anual");
  if (s.hasWealthEntry) out.push("primeiro_registro_patrimonio");
  if (s.hasGoal) out.push("primeira_meta");
  if (s.hasCompletedGoal) out.push("meta_concluida");
  if (s.hasFullQuarter) out.push("revisao_trimestral");
  if (s.hasCompletedChallenge) out.push("primeiro_desafio");
  if (s.hasCompletedFirstUnit) out.push("diagnostico_inicial");
  if (s.hasImportedStatement) out.push("primeiro_extrato");
  if (s.hasPlannedBudget) out.push("primeiro_orcamento");
  if (s.hasInvestmentTrade) out.push("primeiro_investimento");
  if (s.hasAllocationTargets) out.push("carteira_com_metas");
  return out;
}

// ---------- Desafios pessoais ----------
export type ChallengeMetric = "missions" | "active_days" | "wealth_months" | "plan_reviews" | "goals_completed";
export type ChallengeDef = {
  slug: string;
  title: string;
  description: string;
  metric: ChallengeMetric;
  target: number;
  windowDays: number;
};

/** Datas ("YYYY-MM-DD", horário de Brasília) de cada evento que conta para os desafios. */
export type ChallengeInputs = Record<ChallengeMetric, string[]>;

/** Progresso calculado só a partir do que já foi registrado; nada novo é guardado. */
export function challengeProgress(def: ChallengeDef, startedDay: string, inputs: ChallengeInputs, today: string) {
  const end = addDays(startedDay, def.windowDays - 1);
  const inWindow = inputs[def.metric].filter((d) => d >= startedDay && d <= end);
  // Meses de patrimônio contam uma vez por mês; os demais, uma vez por dia.
  const keys = def.metric === "wealth_months" ? inWindow.map((d) => d.slice(0, 7)) : inWindow;
  const count = new Set(keys).size;
  const completed = count >= def.target;
  return {
    done: Math.min(count, def.target),
    target: def.target,
    completed,
    expired: !completed && today > end,
    endsOn: end,
  };
}
