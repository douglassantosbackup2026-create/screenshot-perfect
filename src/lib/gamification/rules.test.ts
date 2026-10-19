import { describe, it, expect } from "vitest";
import {
  XP,
  awardXp,
  computeLevel,
  computeStreak,
  hasThreeConsecutiveMonths,
  spDate,
  weekStartOf,
  type WeekRecord,
} from "./rules";

describe("XP por ação (§8.1)", () => {
  it("valores da tabela", () => {
    expect(XP.lesson_completed).toBe(10);
    expect(XP.quiz_correct).toBe(2);
    expect(XP.weekly_mission).toBe(30);
    expect(XP.first_plan_created).toBe(100);
    expect(XP.contribution_logged).toBe(50);
    expect(XP.plan_quick_review).toBe(20);
    expect(XP.plan_life_event).toBe(40);
    expect(XP.program_completed).toBe(200);
    expect(XP.annual_review).toBe(150);
  });
  it("aporte dá XP uma vez por mês", () => {
    const a = awardXp([], "contribution_logged", "M:2026-10", "x");
    expect(a.awarded).toBe(50);
    const b = awardXp(a.events, "contribution_logged", "M:2026-10", "x");
    expect(b.awarded).toBe(0);
  });
});

describe("níveis (§8.3)", () => {
  it("nível 2 exige plano e 2 meses", () => {
    expect(computeLevel(2, false)).toBe(1);
    expect(computeLevel(2, true)).toBe(2);
  });
  it("nível 3 com 6 meses", () => expect(computeLevel(6, false)).toBe(3));
});

describe("sequência semanal (§8.2)", () => {
  it("horário de Brasília vira o dia às 03:00 UTC", () => {
    expect(spDate(new Date("2026-10-20T02:59:00Z"))).toBe("2026-10-19");
    expect(spDate(new Date("2026-10-20T03:00:00Z"))).toBe("2026-10-20");
  });
  it("semana começa na segunda", () => expect(weekStartOf("2026-10-25")).toBe("2026-10-19"));
  it("semana atual vazia não quebra", () => {
    const w: WeekRecord[] = [
      { weekStart: "2026-10-12", status: "ativa" },
      { weekStart: "2026-10-05", status: "ativa" },
    ];
    expect(computeStreak(w, "2026-10-20").streak).toBe(2);
  });
  it("uma semana vazia entre ativas vira pausa, só uma por mês", () => {
    const w: WeekRecord[] = [
      { weekStart: "2026-10-19", status: "ativa" },
      { weekStart: "2026-10-05", status: "ativa" },
      { weekStart: "2026-09-21", status: "ativa" },
    ];
    // 12/out vira pausa; 28/set também (mês diferente)
    const r = computeStreak(w, "2026-10-20");
    expect(r.streak).toBe(3);
    expect(r.weeks.filter((x) => x.status === "pausa").map((x) => x.weekStart)).toEqual(["2026-10-12", "2026-09-28"]);
  });
  it("duas semanas vazias no mesmo mês quebram", () => {
    const w: WeekRecord[] = [
      { weekStart: "2026-10-26", status: "ativa" },
      { weekStart: "2026-10-12", status: "ativa" },
      { weekStart: "2026-10-05", status: "pausa" },
      { weekStart: "2026-09-28", status: "ativa" },
    ];
    // 19/out estaria vazia, mas outubro já tem pausa → quebra
    expect(computeStreak(w, "2026-10-27").streak).toBe(1);
  });
});

describe("conquista três meses seguidos", () => {
  it("detecta virada de ano", () => {
    expect(hasThreeConsecutiveMonths(["2025-11-01", "2025-12-01", "2026-01-01"])).toBe(true);
    expect(hasThreeConsecutiveMonths(["2026-01-01", "2026-03-01", "2026-04-01"])).toBe(false);
  });
});
