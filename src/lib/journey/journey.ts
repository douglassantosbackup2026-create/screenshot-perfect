// Regras da jornada (mapa, desbloqueios, nivelamento e missão do dia). Funções puras.
// Espelham complete_lesson, submit_placement e complete_daily_mission no banco.
import { LESSONS, type Lesson, type LessonQuestion } from "@/content/program";
import { UNITS, type Unit } from "@/content/journey";

export type NodeStatus = "done" | "current" | "available" | "locked";
export type JourneyNode = { day: number; unit: number; indexInUnit: number; unitSize: number; status: NodeStatus };

export const JOURNEY_ORDER: number[] = UNITS.flatMap((u) => u.lessons);
export const unitOf = (day: number): Unit | undefined => UNITS.find((u) => u.lessons.includes(day));
export const lessonOf = (day: number): Lesson | undefined => LESSONS.find((l) => l.day === day);

/**
 * Uma lição abre quando todas as anteriores na trilha foram concluídas ou pertencem a uma unidade
 * liberada pelo teste. A lição "atual" é a primeira aberta e não concluída fora das unidades testadas.
 */
export function journeyNodes(completed: Iterable<number>, testedOutUnits: number[]): JourneyNode[] {
  const done = new Set(completed);
  const nodes: JourneyNode[] = [];
  let open = true;
  for (const u of UNITS) {
    u.lessons.forEach((day, i) => {
      const isDone = done.has(day);
      nodes.push({ day, unit: u.n, indexInUnit: i + 1, unitSize: u.lessons.length, status: isDone ? "done" : open ? "available" : "locked" });
      open = open && (isDone || testedOutUnits.includes(u.n));
    });
  }
  const current =
    nodes.find((n) => n.status === "available" && !testedOutUnits.includes(n.unit)) ?? nodes.find((n) => n.status === "available");
  if (current) current.status = "current";
  return nodes;
}

export function isLessonUnlocked(day: number, completed: Iterable<number>, testedOutUnits: number[]): boolean {
  const n = journeyNodes(completed, testedOutUnits).find((x) => x.day === day);
  return !!n && n.status !== "locked";
}

export function nextLesson(completed: Iterable<number>, testedOutUnits: number[]): JourneyNode | null {
  return journeyNodes(completed, testedOutUnits).find((n) => n.status === "current") ?? null;
}

export function unitProgress(unit: Unit, completed: Iterable<number>) {
  const done = new Set(completed);
  const count = unit.lessons.filter((d) => done.has(d)).length;
  return { done: count, total: unit.lessons.length, complete: count === unit.lessons.length };
}

// ---------- Teste de nivelamento ----------
export type PlacementQuestion = { key: string; day: number; position: number; question: LessonQuestion };

export function placementQuestions(unitN: number): PlacementQuestion[] {
  const u = UNITS.find((x) => x.n === unitN);
  if (!u) return [];
  return u.placement.flatMap(({ day, position }) => {
    const q = lessonOf(day)?.questions[position - 1];
    return q ? [{ key: `${day}-${position}`, day, position, question: q }] : [];
  });
}

/** O teste vale para a unidade que já está aberta, ainda não foi concluída nem testada e tem perguntas. */
export function canTakePlacement(unitN: number, completed: Iterable<number>, testedOutUnits: number[]): boolean {
  const u = UNITS.find((x) => x.n === unitN);
  if (!u || u.placement.length === 0 || testedOutUnits.includes(unitN)) return false;
  const list = [...completed];
  if (unitProgress(u, list).complete) return false;
  return isLessonUnlocked(u.lessons[0]!, list, testedOutUnits);
}

/** Passa quem acerta todas. `answers` usa a chave "dia-posição". */
export function gradePlacement(unitN: number, answers: Record<string, string>) {
  const qs = placementQuestions(unitN);
  const correct = qs.filter((q) => answers[q.key] === q.question.correct).length;
  return { correct, total: qs.length, passed: qs.length > 0 && correct === qs.length };
}

// ---------- Missão do dia ----------
export type DailyKind = "learn" | "quiz" | "goal" | "scenario" | "review" | "rest";
export type DailyMission = { kind: DailyKind; title: string; description: string; minutes: number; lessonDay: number | null };

/** Dia da semana de uma data "YYYY-MM-DD" (0 = domingo). */
export const weekday = (day: string) => new Date(day + "T12:00:00Z").getUTCDay();

const BY_WEEKDAY: DailyKind[] = ["rest", "learn", "quiz", "goal", "scenario", "review", "rest"];

export function dailyMission(day: string, completed: Iterable<number>, testedOutUnits: number[]): DailyMission {
  const list = [...completed];
  const next = nextLesson(list, testedOutUnits);
  let kind = BY_WEEKDAY[weekday(day)]!;
  // Sem lições concluídas não há o que revisar; com a trilha concluída, não há o que aprender.
  if ((kind === "quiz" || kind === "review") && list.length === 0) kind = "learn";
  if (kind === "learn" && !next) kind = "review";
  const lesson = next ? lessonOf(next.day) : undefined;
  switch (kind) {
    case "learn":
      return { kind, title: `Aprenda: ${lesson!.title}`, description: lesson!.objective, minutes: 4, lessonDay: next!.day };
    case "quiz":
      return { kind, title: "Quiz rápido", description: "Três perguntas sobre o que você já estudou.", minutes: 2, lessonDay: null };
    case "goal":
      return { kind, title: "Revise uma meta", description: "Veja se suas metas ainda fazem sentido e atualize o que mudou.", minutes: 3, lessonDay: null };
    case "scenario":
      return {
        kind,
        title: "Explore um cenário",
        description: "No simulador, veja o que mais muda o seu resultado: prazo, aporte ou retorno.",
        minutes: 3,
        lessonDay: null,
      };
    case "review":
      return { kind, title: "Revise o que aprendeu", description: "Três perguntas para fixar os conceitos da semana.", minutes: 2, lessonDay: null };
    case "rest":
      return {
        kind,
        title: "Descanso ou lição extra",
        description: "Fim de semana é opcional: descanse ou faça uma lição se tiver vontade.",
        minutes: 4,
        lessonDay: next?.day ?? null,
      };
  }
}

/** A missão de hoje aceita esta atividade? No descanso, uma lição extra também conta. */
export function missionAccepts(mission: DailyMission, kind: DailyKind): boolean {
  return mission.kind === kind || (mission.kind === "rest" && kind === "learn");
}

// ---------- Revisão ----------
export type ReviewQuestion = { key: string; day: number; question: LessonQuestion };

function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Perguntas das lições concluídas, sorteadas de forma determinística pela data. */
export function reviewQuestions(completed: Iterable<number>, day: string, n = 3): ReviewQuestion[] {
  const pool = [...new Set(completed)]
    .sort((a, b) => a - b)
    .flatMap((d) => (lessonOf(d)?.questions ?? []).map((question, i) => ({ key: `${d}-${i + 1}`, day: d, question })));
  const rand = seeded(day);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}

/** A revisão conta quando a pessoa acerta pelo menos 2 de 3. */
export const REVIEW_PASS = 2;

/** Corrige uma revisão: só valem perguntas de lições já concluídas (chave "dia-posição"). */
export function gradeReview(answers: Record<string, string>, completed: Iterable<number>) {
  const done = new Set(completed);
  let correct = 0;
  let total = 0;
  for (const [key, opt] of Object.entries(answers)) {
    const [day, pos] = key.split("-").map(Number);
    const q = done.has(day!) ? lessonOf(day!)?.questions[pos! - 1] : undefined;
    if (!q) continue;
    total++;
    if (q.correct === opt) correct++;
  }
  return { correct, total, passed: total >= 3 && correct >= REVIEW_PASS };
}
