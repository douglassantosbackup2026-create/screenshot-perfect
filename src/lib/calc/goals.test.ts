import { describe, it, expect } from "vitest";
import { goalCurrent, goalPlan, monthsToGoal, monthsUntil, requiredMonthly } from "./goals";

describe("goalCurrent", () => {
  it("soma itens do Patrimônio (reais) e saldos de contas (centavos)", () => {
    expect(goalCurrent([1000, 500], [250000])).toBe(4000);
    expect(goalCurrent([], [])).toBe(0);
  });
  it("saldo negativo não vira progresso negativo", () => {
    expect(goalCurrent([], [-50000])).toBe(0);
  });
});

describe("monthsUntil", () => {
  it("conta meses até o mês do prazo", () => {
    expect(monthsUntil("2026-10-30", "2027-10-01")).toBe(12);
    expect(monthsUntil("2026-10-30", "2026-10-01")).toBe(0);
    expect(monthsUntil("2026-10-30", "2025-01-01")).toBe(0);
  });
});

describe("requiredMonthly", () => {
  it("sem rendimento: divide o que falta pelos meses", () => {
    expect(requiredMonthly(12000, 0, 12, 0)).toBe(1000);
    expect(requiredMonthly(12000, 6000, 12, 0)).toBe(500);
  });
  it("com rendimento: precisa guardar menos que a divisão simples", () => {
    const m = requiredMonthly(12000, 0, 12, 0.03);
    expect(m).toBeLessThan(1000);
    expect(m).toBeGreaterThan(980);
  });
  it("já chegou: zero; prazo vencido: o que falta de uma vez", () => {
    expect(requiredMonthly(1000, 1500, 12)).toBe(0);
    expect(requiredMonthly(1000, 400, 0)).toBe(600);
  });
});

describe("monthsToGoal", () => {
  it("quantos meses no ritmo informado", () => {
    expect(monthsToGoal(12000, 0, 1000, 0)).toBe(12);
    expect(monthsToGoal(12000, 0, 999, 0)).toBe(13);
    expect(monthsToGoal(100, 200, 0)).toBe(0);
  });
  it("ritmo zero não chega", () => {
    expect(monthsToGoal(12000, 0, 0, 0)).toBeNull();
  });
});

describe("goalPlan", () => {
  const base = { target: 12000, current: 0, today: "2026-10-30", deadline: "2027-10-01", annualReturn: 0 };
  it("em dia quando o ritmo chega antes do prazo", () => {
    const p = goalPlan({ ...base, monthlyContribution: 1000 });
    expect(p.verdict).toBe("em_dia");
    expect(p.requiredMonthly).toBe(1000);
    expect(p.etaMonths).toBe(12);
  });
  it("atrasada quando o ritmo não chega", () => {
    expect(goalPlan({ ...base, monthlyContribution: 500 }).verdict).toBe("atrasada");
  });
  it("sem ritmo informado, diz só quanto guardar", () => {
    const p = goalPlan({ ...base, monthlyContribution: null });
    expect(p.verdict).toBe("sem_ritmo");
    expect(p.requiredMonthly).toBe(1000);
  });
  it("sem prazo, vencida e concluída", () => {
    expect(goalPlan({ ...base, deadline: null, monthlyContribution: 1000 }).verdict).toBe("sem_prazo");
    expect(goalPlan({ ...base, deadline: "2026-09-01", monthlyContribution: 1000 }).verdict).toBe("vencida");
    const done = goalPlan({ ...base, current: 15000, monthlyContribution: null });
    expect(done.verdict).toBe("concluida");
    expect(done.pct).toBe(1);
    expect(done.missing).toBe(0);
  });
});
