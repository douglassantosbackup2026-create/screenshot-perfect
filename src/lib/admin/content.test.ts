import { describe, expect, it } from "vitest";
import { lessonFromRow, lessonPayload, lessonsFromFile } from "./content";

describe("conteúdo do admin", () => {
  it("arquivo → payload → linha do banco → editor devolve a mesma lição", () => {
    const l = { ...lessonsFromFile()[0]!, reviewedBy: " Ana ", reviewedAt: "2026-10-01", sources: [{ label: "Fonte", url: "https://x" }, { label: "", url: "" }] };
    const p = lessonPayload(l) as Record<string, unknown>;
    expect(p["reviewedBy"]).toBe("Ana");
    expect(p["sources"]).toEqual([{ label: "Fonte", url: "https://x" }]);
    expect(p["actionKey"]).toBe("");

    const back = lessonFromRow({
      day: l.day,
      title: l.title,
      objective: l.objective,
      key_points: l.keyPoints,
      body_md: null,
      action_key: null,
      sources: p["sources"] as never,
      reviewed_by: "Ana",
      reviewed_at: "2026-10-01",
      status: "revisada",
      lesson_questions: [...l.questions].reverse().map((q, i) => ({
        position: l.questions.length - i,
        prompt: q.prompt,
        options: q.options,
        correct_option: q.correct,
        explanation: q.explanation,
      })),
    });
    expect(back.questions).toEqual(l.questions);
    expect(back.status).toBe("revisada");
  });

  it("JSON fora do formato vira vazio, sem quebrar", () => {
    const l = lessonFromRow({
      day: 1, title: "t", objective: "o", key_points: { x: 1 }, body_md: null, action_key: "invalida",
      sources: "nada", reviewed_by: null, reviewed_at: null, status: "rascunho", lesson_questions: [],
    });
    expect(l).toMatchObject({ keyPoints: [], sources: [], actionKey: null, reviewedBy: "", reviewedAt: "" });
  });
});
