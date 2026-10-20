import { describe, it, expect } from "vitest";
import {
  XP,
  challengeProgress,
  computeDayStreak,
  goalCreatedPeriodKey,
  hasFullQuarter,
  type ChallengeDef,
  type XpEvent,
  awardXp,
  levelFromXp,
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
    expect(XP.contribution_logged).toBe(20);
    expect(XP.plan_quick_review).toBe(20);
    expect(XP.plan_life_event).toBe(40);
    expect(XP.program_completed).toBe(200);
    expect(XP.annual_review).toBe(150);
  });
  it("registrar o mês dá XP uma vez por mês", () => {
    const a = awardXp([], "contribution_logged", "M:2026-10", "x");
    expect(a.awarded).toBe(20);
    const b = awardXp(a.events, "contribution_logged", "M:2026-10", "x");
    expect(b.awarded).toBe(0);
  });
});

describe("níveis por XP", () => {
  it("limites", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, name: "Iniciante", min: 0, next: 100 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(240)).toEqual({ level: 2, name: "Planejador", min: 100, next: 300 });
    expect(levelFromXp(5000)).toEqual({ level: 5, name: "Mestre do plano", min: 1000, next: null });
  });
  it("missão do dia vale 10 XP", () => expect(XP.daily_mission).toBe(10));
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

describe("sequência diária com proteção", () => {
  it("hoje sem atividade não quebra", () => {
    expect(computeDayStreak(["2026-10-17", "2026-10-18"], "2026-10-19").streak).toBe(2);
  });
  it("lista vazia", () => expect(computeDayStreak([], "2026-10-19")).toEqual({ streak: 0, protectedDays: [] }));
  it("até 2 dias vazios por semana são protegidos", () => {
    // semana de 12/out: 13 e 15 vazios (2 proteções) → não quebra
    const days = ["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-17", "2026-10-18"];
    const r = computeDayStreak(days, "2026-10-18");
    expect(r.streak).toBe(5);
    expect(r.protectedDays).toEqual(["2026-10-15", "2026-10-13"]);
  });
  it("terceiro dia vazio na mesma semana quebra", () => {
    const days = ["2026-10-12", "2026-10-15", "2026-10-18"];
    // 17 e 16 protegidos; 14 vazio seria a 3ª proteção → quebra
    expect(computeDayStreak(days, "2026-10-18").streak).toBe(2);
  });
  it("proteções antes do primeiro dia ativo não contam", () => {
    const r = computeDayStreak(["2026-10-18"], "2026-10-18");
    expect(r).toEqual({ streak: 1, protectedDays: [] });
  });
});

describe("novas ações de XP", () => {
  it("valores", () => {
    expect(XP.wealth_logged).toBe(30);
    expect(XP.goal_created).toBe(20);
    expect(XP.goal_completed).toBe(60);
    expect(XP.challenge_completed).toBe(40);
  });
  it("meta criada dá XP no máximo 3 vezes por mês", () => {
    let events: XpEvent[] = [];
    for (const id of ["a", "b", "c"]) {
      const key = goalCreatedPeriodKey(events, "2026-10-01", id);
      expect(key).toBe(`G:2026-10:${id}`);
      events = awardXp(events, "goal_created", key!, "x").events;
    }
    expect(goalCreatedPeriodKey(events, "2026-10-01", "d")).toBeNull();
    expect(goalCreatedPeriodKey(events, "2026-11-01", "d")).toBe("G:2026-11:d");
  });
});

describe("revisão trimestral", () => {
  it("exige os 3 meses do trimestre e uma revisão nele", () => {
    const months = ["2026-07-01", "2026-08-01", "2026-09-01"];
    expect(hasFullQuarter(months, ["2026-08-10"])).toBe(true);
    expect(hasFullQuarter(months, ["2026-10-02"])).toBe(false);
    expect(hasFullQuarter(months.slice(1), ["2026-08-10"])).toBe(false);
  });
});

describe("desafios pessoais", () => {
  const def: ChallengeDef = { slug: "x", title: "", description: "", metric: "active_days", target: 3, windowDays: 5 };
  const empty = { missions: [], active_days: [], wealth_months: [], plan_reviews: [], goals_completed: [] };
  it("conta só dentro da janela, um por dia", () => {
    const r = challengeProgress(def, "2026-10-10", { ...empty, active_days: ["2026-10-09", "2026-10-10", "2026-10-10", "2026-10-12"] }, "2026-10-12");
    expect(r).toMatchObject({ done: 2, target: 3, completed: false, expired: false, endsOn: "2026-10-14" });
  });
  it("conclui ao atingir a meta e expira depois da janela", () => {
    const days = ["2026-10-10", "2026-10-11", "2026-10-14"];
    expect(challengeProgress(def, "2026-10-10", { ...empty, active_days: days }, "2026-10-20").completed).toBe(true);
    expect(challengeProgress(def, "2026-10-10", { ...empty, active_days: days.slice(0, 2) }, "2026-10-15").expired).toBe(true);
  });
  it("patrimônio conta uma vez por mês", () => {
    const w: ChallengeDef = { ...def, metric: "wealth_months", windowDays: 100 };
    expect(challengeProgress(w, "2026-07-01", { ...empty, wealth_months: ["2026-07-01", "2026-07-20", "2026-08-01"] }, "2026-08-02").done).toBe(2);
  });
});
