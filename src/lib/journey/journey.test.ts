import { describe, expect, it } from "vitest";
import { LESSONS } from "@/content/program";
import { UNITS } from "@/content/journey";
import {
  JOURNEY_ORDER,
  canTakePlacement,
  dailyMission,
  gradePlacement,
  isLessonUnlocked,
  journeyNodes,
  missionAccepts,
  nextLesson,
  placementQuestions,
  reviewQuestions,
  weekday,
} from "./journey";

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

describe("trilha", () => {
  it("usa as 21 lições uma única vez", () => {
    expect([...JOURNEY_ORDER].sort((a, b) => a - b)).toEqual(LESSONS.map((l) => l.day).sort((a, b) => a - b));
  });

  it("começa com a primeira lição da Unidade 1 e o resto bloqueado", () => {
    const nodes = journeyNodes([], []);
    expect(nodes[0]).toMatchObject({ day: 1, unit: 1, status: "current" });
    expect(nodes.slice(1).every((n) => n.status === "locked")).toBe(true);
  });

  it("progresso livre: concluir abre a próxima na hora", () => {
    expect(nextLesson([1], [])?.day).toBe(2);
    expect(isLessonUnlocked(2, [1], [])).toBe(true);
    expect(isLessonUnlocked(4, [1], [])).toBe(false);
  });

  it("exemplo da Ana (dias 1 a 14): unidades 1 e 2 concluídas, Unidade 3 na lição 16", () => {
    const nodes = journeyNodes(range(1, 14), []);
    expect(nodes.filter((n) => n.unit <= 2).every((n) => n.status === "done")).toBe(true);
    expect(nextLesson(range(1, 14), [])).toMatchObject({ day: 16, unit: 3, indexInUnit: 5 });
    expect(isLessonUnlocked(15, range(1, 14), [])).toBe(false);
  });

  it("unidade testada abre a seguinte e a atual pula para ela", () => {
    expect(nextLesson([], [1])).toMatchObject({ day: 6, unit: 2 });
    expect(isLessonUnlocked(4, [], [1])).toBe(true);
    expect(isLessonUnlocked(9, [], [1])).toBe(false);
  });
});

describe("teste de nivelamento", () => {
  it("cada unidade com teste tem 3 perguntas válidas; a Unidade 4 não tem", () => {
    for (const u of UNITS.filter((x) => x.n < 4)) expect(placementQuestions(u.n)).toHaveLength(3);
    expect(placementQuestions(4)).toEqual([]);
  });

  it("passa só com todas certas", () => {
    const qs = placementQuestions(1);
    const right = Object.fromEntries(qs.map((q) => [q.key, q.question.correct]));
    expect(gradePlacement(1, right)).toEqual({ correct: 3, total: 3, passed: true });
    const oneWrong = { ...right, [qs[0]!.key]: "zzz" };
    expect(gradePlacement(1, oneWrong).passed).toBe(false);
  });

  it("só para a unidade aberta e não concluída", () => {
    expect(canTakePlacement(1, [], [])).toBe(true);
    expect(canTakePlacement(2, [], [])).toBe(false);
    expect(canTakePlacement(2, [], [1])).toBe(true);
    expect(canTakePlacement(1, [1, 2, 4, 5, 8], [])).toBe(false);
    expect(canTakePlacement(4, range(1, 14).concat([16]), [])).toBe(false);
  });
});

describe("missão do dia", () => {
  it("segue o dia da semana (19/10/2026 é segunda)", () => {
    expect(weekday("2026-10-19")).toBe(1);
    const done = [1, 2];
    expect(dailyMission("2026-10-19", done, []).kind).toBe("learn");
    expect(dailyMission("2026-10-19", done, []).lessonDay).toBe(4);
    expect(dailyMission("2026-10-20", done, []).kind).toBe("quiz");
    expect(dailyMission("2026-10-21", done, []).kind).toBe("goal");
    expect(dailyMission("2026-10-22", done, []).kind).toBe("scenario");
    expect(dailyMission("2026-10-23", done, []).kind).toBe("review");
    expect(dailyMission("2026-10-24", done, []).kind).toBe("rest");
    expect(dailyMission("2026-10-25", done, []).kind).toBe("rest");
  });

  it("sem lições concluídas, quiz vira aprender; trilha completa, aprender vira revisão", () => {
    expect(dailyMission("2026-10-20", [], []).kind).toBe("learn");
    expect(dailyMission("2026-10-19", JOURNEY_ORDER, []).kind).toBe("review");
  });

  it("no descanso, uma lição extra conta", () => {
    const m = dailyMission("2026-10-24", [1], []);
    expect(missionAccepts(m, "learn")).toBe(true);
    expect(missionAccepts(m, "goal")).toBe(false);
  });
});

describe("revisão", () => {
  it("é determinística pela data e só usa lições concluídas", () => {
    const a = reviewQuestions([1, 2], "2026-10-20");
    expect(a).toHaveLength(3);
    expect(reviewQuestions([1, 2], "2026-10-20")).toEqual(a);
    expect(a.every((q) => q.day === 1 || q.day === 2)).toBe(true);
    expect(reviewQuestions([], "2026-10-20")).toEqual([]);
  });
});
