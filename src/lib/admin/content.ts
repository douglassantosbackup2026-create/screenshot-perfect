// Conteúdo do programa no banco (programs, lessons, lesson_questions, weekly_missions), lido e gravado
// pelo editor de admin. As telas das pessoas continuam lendo src/content até a jornada voltar.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { LESSONS, PROGRAM, type ActionKey, type LessonQuestion } from "@/content/program";
import { MISSIONS, type Mission } from "@/content/missions";
import type { ContentStatus } from "@/lib/content-rules";

export type EditLesson = {
  day: number;
  title: string;
  objective: string;
  keyPoints: string[];
  bodyMd: string;
  actionKey: ActionKey | null;
  sources: { label: string; url: string }[];
  reviewedBy: string;
  reviewedAt: string;
  status: ContentStatus;
  questions: LessonQuestion[];
};
export type EditMission = Mission & { status: ContentStatus };

const ACTION_KEYS: ActionKey[] = ["set_goal", "create_plan", "first_contribution"];
const HINTS: Mission["hint"][] = ["plan_quick_review", "micro_lesson", "challenge", "reflection"];

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asString = (v: unknown) => (typeof v === "string" ? v : "");

/** Lições do arquivo (src/content/program.ts) no formato do editor, como rascunho. */
export function lessonsFromFile(): EditLesson[] {
  return LESSONS.map((l) => ({
    day: l.day,
    title: l.title,
    objective: l.objective,
    keyPoints: [...l.keyPoints],
    bodyMd: "",
    actionKey: l.actionKey,
    sources: l.sources.map((s) => ({ ...s })),
    reviewedBy: "",
    reviewedAt: "",
    status: "rascunho",
    questions: l.questions.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) })),
  }));
}

export function missionsFromFile(): EditMission[] {
  return MISSIONS.map((m) => ({ ...m, status: "rascunho" }));
}

type LessonRow = {
  day: number;
  title: string;
  objective: string;
  key_points: Json;
  body_md: string | null;
  action_key: string | null;
  sources: Json;
  reviewed_by: string | null;
  reviewed_at: string | null;
  status: ContentStatus;
  lesson_questions: { position: number; prompt: string; options: Json; correct_option: string; explanation: string }[];
};

/** Linha do banco → formato do editor. JSON fora do formato vira vazio (nunca quebra o editor). */
export function lessonFromRow(r: LessonRow): EditLesson {
  return {
    day: r.day,
    title: r.title,
    objective: r.objective,
    keyPoints: asArray(r.key_points).map(asString),
    bodyMd: r.body_md ?? "",
    actionKey: ACTION_KEYS.find((k) => k === r.action_key) ?? null,
    sources: asArray(r.sources).map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      return { label: asString(o["label"]), url: asString(o["url"]) };
    }),
    reviewedBy: r.reviewed_by ?? "",
    reviewedAt: r.reviewed_at ?? "",
    status: r.status,
    questions: [...r.lesson_questions]
      .sort((a, b) => a.position - b.position)
      .map((q) => ({
        prompt: q.prompt,
        options: asArray(q.options).map((o) => {
          const x = (o ?? {}) as Record<string, unknown>;
          return { id: asString(x["id"]), text: asString(x["text"]) };
        }),
        correct: q.correct_option,
        explanation: q.explanation,
      })),
  };
}

/** Formato do editor → argumento de admin_save_lesson (fontes vazias ficam de fora). */
export function lessonPayload(l: EditLesson): Json {
  return {
    day: l.day,
    title: l.title.trim(),
    objective: l.objective.trim(),
    keyPoints: l.keyPoints.map((k) => k.trim()).filter(Boolean),
    bodyMd: l.bodyMd,
    actionKey: l.actionKey ?? "",
    sources: l.sources.filter((s) => s.label.trim() || s.url.trim()).map((s) => ({ label: s.label.trim(), url: s.url.trim() })),
    reviewedBy: l.reviewedBy.trim(),
    reviewedAt: l.reviewedAt,
    status: l.status,
    questions: l.questions.map((q) => ({ prompt: q.prompt, options: q.options, correct: q.correct, explanation: q.explanation })),
  };
}

export type LoadedContent = { lessons: EditLesson[]; missions: EditMission[]; fromDb: { lessons: boolean; missions: boolean } };

/**
 * Carrega do banco. O que ainda não existe lá vem do arquivo, marcado como não salvo (fromDb false):
 * o primeiro "Salvar" grava.
 */
export async function loadContent(): Promise<LoadedContent> {
  const [lessonsRes, missionsRes] = await Promise.all([
    supabase
      .from("lessons")
      .select("day, title, objective, key_points, body_md, action_key, sources, reviewed_by, reviewed_at, status, lesson_questions(position, prompt, options, correct_option, explanation), programs!inner(slug)")
      .eq("programs.slug", PROGRAM.slug)
      .order("day"),
    supabase.from("weekly_missions").select("slug, title, description, action_hint, sort_order, status").order("sort_order"),
  ]);
  if (lessonsRes.error) throw lessonsRes.error;
  if (missionsRes.error) throw missionsRes.error;

  const dbLessons = (lessonsRes.data as unknown as LessonRow[]).map(lessonFromRow);
  const byDay = new Map(dbLessons.map((l) => [l.day, l]));
  const lessons = lessonsFromFile().map((f) => byDay.get(f.day) ?? f);
  for (const l of dbLessons) if (!lessons.some((x) => x.day === l.day)) lessons.push(l);

  const dbMissions: EditMission[] = missionsRes.data.map((m) => ({
    order: m.sort_order,
    slug: m.slug,
    title: m.title,
    description: m.description,
    hint: HINTS.find((h) => h === m.action_hint) ?? "reflection",
    status: m.status,
  }));

  return {
    lessons: lessons.sort((a, b) => a.day - b.day),
    missions: dbMissions.length ? dbMissions : missionsFromFile(),
    fromDb: { lessons: dbLessons.length > 0, missions: dbMissions.length > 0 },
  };
}

export async function saveLesson(l: EditLesson): Promise<void> {
  const { error } = await supabase.rpc("admin_save_lesson", { p_program_slug: PROGRAM.slug, p_lesson: lessonPayload(l) });
  if (error) throw error;
}

export async function saveMissions(ms: EditMission[]): Promise<void> {
  const rows = ms.map((m) => ({ slug: m.slug, title: m.title.trim(), description: m.description.trim(), action_hint: m.hint, sort_order: m.order, status: m.status }));
  const { error } = await supabase.from("weekly_missions").upsert(rows, { onConflict: "slug" });
  if (error) throw error;
}

export async function deleteMission(slug: string): Promise<void> {
  const { error } = await supabase.from("weekly_missions").delete().eq("slug", slug);
  if (error) throw error;
}
