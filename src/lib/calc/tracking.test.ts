import { describe, it, expect } from "vitest";
import { planCorridor, progressVerdict, retirementImpact, type CorridorPoint } from "./tracking";
import type { PlanInputs } from "./retirement";

const anchor: PlanInputs = {
  currentAge: 30,
  retirementAge: 60,
  horizonAge: 95,
  initialWealth: 10000,
  monthlyContribution: 1000,
  desiredMonthlyIncome: 8000,
  inssEstimate: null,
  returns: { conservador: 0.02, central: 0.04, otimista: 0.06 },
  inflationAA: 0.04,
  costsAA: 0,
};
const flat: PlanInputs = {
  ...anchor,
  initialWealth: 0,
  retirementAge: 31,
  returns: { conservador: 0, central: 0, otimista: 0 },
};

describe("corredor do plano", () => {
  it("começa no patrimônio da âncora e abre com o tempo", () => {
    const c = planCorridor(anchor, "2026-01-01", [], "2026-12-01");
    expect(c).toHaveLength(12);
    expect(c[0]).toMatchObject({
      month: "2026-01-01",
      low: 10000,
      central: 10000,
      high: 10000,
      actual: null,
    });
    const last = c[11]!;
    expect(last.month).toBe("2026-12-01");
    expect(last.low).toBeLessThan(last.central);
    expect(last.central).toBeLessThan(last.high);
  });
  it("retorno zero: patrimônio inicial + aportes", () => {
    const c = planCorridor(
      { ...anchor, returns: { conservador: 0, central: 0, otimista: 0 } },
      "2026-11-01",
      [],
      "2027-02-01",
    );
    expect(c.map((p) => p.central)).toEqual([10000, 11000, 12000, 13000]);
    expect(c[3]!.month).toBe("2027-02-01");
  });
  it("encaixa os registros por mês e ignora os de antes da âncora", () => {
    const c = planCorridor(
      anchor,
      "2026-03-01",
      [
        { month: "2026-01-01", total: 1 },
        { month: "2026-04-01", total: 12000 },
      ],
      "2026-04-01",
    );
    expect(c.map((p) => p.actual)).toEqual([null, 12000]);
  });
  it("fim antes da âncora: vazio", () => {
    expect(planCorridor(anchor, "2026-03-01", [], "2026-01-01")).toEqual([]);
  });
});

describe("veredito", () => {
  const pt = (actual: number | null): CorridorPoint => ({
    month: "2026-06-01",
    low: 100,
    central: 110,
    high: 120,
    actual,
  });
  it("acima do corredor", () => expect(progressVerdict([pt(130)])!.code).toBe("a_frente"));
  it("dentro do corredor", () => expect(progressVerdict([pt(100)])!.code).toBe("no_ritmo"));
  it("abaixo, mas a menos de 7% da borda baixa", () => {
    const v = progressVerdict([pt(95)])!;
    expect(v.code).toBe("levemente_atras");
    expect(v.shortfallPct).toBeCloseTo(0.05);
    expect(v.deviation).toBe(-15);
  });
  it("abaixo, 7% ou mais", () => expect(progressVerdict([pt(93)])!.code).toBe("atras"));
  it("usa o registro mais recente", () => {
    expect(progressVerdict([pt(130), { ...pt(null), month: "2026-07-01" }])!.month).toBe(
      "2026-06-01",
    );
  });
  it("sem registro: null", () => expect(progressVerdict([pt(null)])).toBeNull());
});

describe("impacto na aposentadoria", () => {
  it("atrás: 2 meses a mais (retorno zero, conta à mão)", () => {
    const r = retirementImpact(flat, "2026-01-01", "2026-03-01", 0)!;
    expect(r.plannedAtRetirement).toBe(12000);
    expect(r.paceAtRetirement).toBe(10000);
    expect(r.deltaPct).toBeCloseTo(-1 / 6);
    expect(r.monthsLate).toBe(2);
  });
  it("à frente: 3 meses de folga", () => {
    const r = retirementImpact(flat, "2026-01-01", "2026-03-01", 5000)!;
    expect(r.paceAtRetirement).toBe(15000);
    expect(r.monthsLate).toBe(-3);
  });
  it("no caminho central: sem impacto", () => {
    const c = planCorridor(anchor, "2026-01-01", [], "2026-07-01");
    const r = retirementImpact(anchor, "2026-01-01", "2026-07-01", c[6]!.central)!;
    expect(r.deltaPct).toBeCloseTo(0, 9);
    expect(r.monthsLate).toBe(0);
  });
  it("depois da aposentadoria: null", () => {
    expect(retirementImpact(flat, "2026-01-01", "2027-01-01", 0)).toBeNull();
  });
});
