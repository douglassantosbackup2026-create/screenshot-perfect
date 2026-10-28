import { describe, it, expect } from 'vitest';
import { earliestRetirementAge, scenarioDelta, simulate, projectSeries, validateInputs, type PlanInputs } from './retirement';

const base: PlanInputs = {
  currentAge: 30, retirementAge: 60, horizonAge: 95, initialWealth: 10000, monthlyContribution: 1000,
  desiredMonthlyIncome: 8000, inssEstimate: 4500,
  returns: { conservador: 0.02, central: 0.04, otimista: 0.06 }, inflationAA: 0.04, costsAA: 0,
};
const close = (got: number, exp: number, tol = 0.05) => expect(Math.abs(got - exp)).toBeLessThanOrEqual(tol);

describe('motor de aposentadoria calc-1.0.0', () => {
  it('A: sem INSS', () => {
    const r = simulate(base, 'central', false);
    close(r.projectedWealthAtRetirement, 717704.54);
    close(r.targetWealth, 1824419.97);
    close(r.requiredMonthlyContribution, 2615.01);
    close(r.sustainableMonthlyIncome, 3147.10);
    close(r.depletionAge!, 68.8655, 0.001);
    close(r.projectedWealthNominal, 2327801.12, 0.5);
  });
  it('B: com INSS', () => {
    const r = simulate(base, 'central', true);
    close(r.targetWealth, 798183.74);
    close(r.requiredMonthlyContribution, 1117.44);
    close(r.depletionAge!, 88.3685, 0.001);
  });
  it('C: retorno zero', () => {
    const r = simulate({ ...base, returns: { ...base.returns, central: 0 } }, 'central', false);
    close(r.projectedWealthAtRetirement, 370000);
    close(r.targetWealth, 3360000);
    close(r.requiredMonthlyContribution, 9305.56);
    close(r.sustainableMonthlyIncome, 880.95);
  });
  it('D: horizonte curto', () => {
    const r = simulate({ ...base, currentAge: 50, retirementAge: 55, initialWealth: 200000, monthlyContribution: 2000,
      desiredMonthlyIncome: 6000, returns: { ...base.returns, central: 0.035 } }, 'central', false);
    close(r.projectedWealthAtRetirement, 368288.17);
    close(r.targetWealth, 1562077.12);
    close(r.requiredMonthlyContribution, 20260.51);
  });
  it('E: custos', () => {
    const r = simulate({ ...base, costsAA: 0.01 }, 'central', false);
    close(r.projectedWealthAtRetirement, 599923.34);
    close(r.targetWealth, 2099802.80);
    close(r.requiredMonthlyContribution, 3604.59);
  });
  it('F: começando do zero', () => {
    const r = simulate({ ...base, currentAge: 35, retirementAge: 65, initialWealth: 0, monthlyContribution: 0,
      desiredMonthlyIncome: 5000 }, 'central', false);
    close(r.targetWealth, 1056408.54);
    close(r.requiredMonthlyContribution, 1541.59);
    close(r.depletionAge!, 65, 0.001);
  });
  it('G: INSS cobre a renda', () => {
    const r = simulate({ ...base, inssEstimate: 9000 }, 'central', true);
    expect(r.targetWealth).toBe(0);
    expect(r.requiredMonthlyContribution).toBe(0);
    expect(r.depletionAge).toBeNull();
  });
  it('série do gráfico', () => {
    const s = projectSeries(base, 'central', false);
    close(s.find(p => p.age === 60)!.wealth, 717704.54, 0.5);
    expect(s.find(p => p.age === 69)!.wealth).toBe(0);
  });
  it('validação', () => {
    expect(validateInputs({ ...base, retirementAge: 25 })).toHaveLength(1);
    expect(validateInputs(base)).toHaveLength(0);
  });
});

describe('idade mínima de aposentadoria', () => {
  const flat: PlanInputs = {
    ...base, initialWealth: 0, monthlyContribution: 1000, desiredMonthlyIncome: 1000, inssEstimate: null,
    returns: { conservador: 0, central: 0, otimista: 0 },
  };
  it('retorno zero: conta à mão (1000·k ≥ 1000·(780 − k) → k = 390)', () => {
    const r = earliestRetirementAge(flat, 'central', false)!;
    expect(r.monthsFromNow).toBe(390);
    expect(r.age).toBe(62.5);
  });
  it('é a primeira idade que fecha: um mês antes ainda falta', () => {
    const r = earliestRetirementAge(base, 'central', false)!;
    expect(r.result.gap).toBeLessThanOrEqual(0);
    expect(simulate({ ...base, retirementAge: r.age - 1 / 12 }, 'central', false).gap).toBeGreaterThan(0);
  });
  it('INSS cobre a renda: já no primeiro mês', () => {
    expect(earliestRetirementAge({ ...base, inssEstimate: 9000 }, 'central', true)!.monthsFromNow).toBe(1);
  });
  it('sem patrimônio nem aporte: nenhuma idade fecha', () => {
    expect(earliestRetirementAge({ ...flat, monthlyContribution: 0 }, 'central', false)).toBeNull();
  });
  it('cenário otimista permite parar antes', () => {
    expect(earliestRetirementAge(base, 'otimista', false)!.age).toBeLessThan(earliestRetirementAge(base, 'conservador', false)!.age);
  });
});

describe('diferença do "E se…?"', () => {
  it('mesmo plano: tudo zero', () => {
    const r = simulate(base, 'central', false);
    expect(Object.values(scenarioDelta(r, r)).every(v => v === 0)).toBe(true);
  });
  it('aporte maior: patrimônio projetado sobe, alvo e aporte necessário não mudam', () => {
    const d = scenarioDelta(simulate(base, 'central', false), simulate({ ...base, monthlyContribution: 2000 }, 'central', false));
    expect(d.projectedWealthAtRetirement).toBeGreaterThan(0);
    expect(d.gap).toBeLessThan(0);
    expect(d.targetWealth).toBe(0);
    expect(d.requiredMonthlyContribution).toBe(0);
  });
});
