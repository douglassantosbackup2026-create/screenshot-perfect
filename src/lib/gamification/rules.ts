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
  | "annual_review";

export const XP: Record<XpAction, number> = {
  lesson_completed: 10,
  quiz_correct: 2,
  weekly_mission: 30,
  first_plan_created: 100,
  contribution_logged: 50,
  plan_quick_review: 20,
  plan_life_event: 40,
  program_completed: 200,
  annual_review: 150,
};

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

// ---------- Níveis ----------
export function computeLevel(contributionMonthsWithXp: number, hasPlan: boolean): number {
  if (contributionMonthsWithXp >= 6) return 3;
  if (hasPlan && contributionMonthsWithXp >= 2) return 2;
  return 1;
}

export const LEVELS = [
  { level: 1, name: "Despertar", how: "Ao criar a conta", available: true },
  { level: 2, name: "Plano", how: "Plano criado e 2 meses com aporte registrado em dia", available: true },
  { level: 3, name: "Constância", how: "6 meses com aporte registrado em dia", available: true },
  { level: 4, name: "Estratégia", how: "Programa avançado e revisão anual", available: false },
  { level: 5, name: "Independência", how: "Programa de desacumulação", available: false },
] as const;

// ---------- Conquistas ----------
export type AchievementCode =
  | "primeiro_plano"
  | "primeiro_aporte"
  | "tres_meses_seguidos"
  | "reserva_montada"
  | "plano_ajustado"
  | "programa_21_concluido"
  | "primeira_revisao_anual";

export const ACHIEVEMENTS: { code: AchievementCode; title: string; description: string; icon: string }[] = [
  { code: "primeiro_plano", title: "Primeiro plano", description: "Você criou seu plano de aposentadoria.", icon: "map" },
  { code: "primeiro_aporte", title: "Primeiro aporte", description: "Seu fio da constância começou.", icon: "sprout" },
  { code: "tres_meses_seguidos", title: "Três meses de constância", description: "Aportes registrados em três meses seguidos.", icon: "calendar-check" },
  { code: "reserva_montada", title: "Reserva de emergência", description: "Você informou que sua reserva está montada.", icon: "shield" },
  { code: "plano_ajustado", title: "Plano ajustado", description: "Você revisou o plano depois de uma mudança de vida.", icon: "refresh-cw" },
  { code: "programa_21_concluido", title: "21 dias concluídos", description: "Você terminou o programa Meu plano sem depender do INSS.", icon: "flag" },
  { code: "primeira_revisao_anual", title: "Primeira revisão anual", description: "Você fez a revisão completa do seu plano.", icon: "award" },
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

export function eligibleAchievements(s: {
  hasPlan: boolean;
  contributionMonthKeys: string[];
  emergencyFundReady: boolean;
  hasLifeEvent: boolean;
  programCompleted: boolean;
  hasAnnualReview: boolean;
}): AchievementCode[] {
  const out: AchievementCode[] = [];
  if (s.hasPlan) out.push("primeiro_plano");
  if (s.contributionMonthKeys.length >= 1) out.push("primeiro_aporte");
  if (hasThreeConsecutiveMonths(s.contributionMonthKeys)) out.push("tres_meses_seguidos");
  if (s.emergencyFundReady) out.push("reserva_montada");
  if (s.hasLifeEvent) out.push("plano_ajustado");
  if (s.programCompleted) out.push("programa_21_concluido");
  if (s.hasAnnualReview) out.push("primeira_revisao_anual");
  return out;
}
