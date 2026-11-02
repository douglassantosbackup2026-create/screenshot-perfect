// Confere o motor de aposentadoria contra uma implementação independente: tudo mês a mês, em laço, sem as
// fórmulas fechadas de retirement.ts. Valor exigido e renda sustentável saem por bisseção, não por fórmula.
// Mesmas convenções do motor: valores reais, aportes e retiradas no fim do mês, custos dividindo o retorno.
import { describe, it, expect } from 'vitest';
import {
  earliestRetirementAge,
  projectSeries,
  simulate,
  validateInputs,
  type PlanInputs,
  type ScenarioKey,
} from './retirement';

// ---------- implementação de referência ----------
const factor = (i: PlanInputs, s: ScenarioKey) => Math.pow((1 + i.returns[s]) / (1 + i.costsAA), 1 / 12);

function accumulate(w0: number, c: number, f: number, months: number) {
  let w = w0;
  for (let k = 0; k < months; k++) w = w * f + c;
  return w;
}

/** Quanto precisa ter no início para retirar `p` por mês durante `months` meses. */
function presentValue(p: number, f: number, months: number) {
  let pv = 0;
  let d = 1;
  for (let k = 0; k < months; k++) {
    d /= f;
    pv += p * d;
  }
  return pv;
}

/** Saldo final depois de retirar `p` por mês durante `months` meses (pode ficar negativo). */
function drawdown(w0: number, p: number, f: number, months: number) {
  let w = w0;
  for (let k = 0; k < months; k++) w = w * f - p;
  return w;
}

function bisect(fn: (x: number) => number, lo: number, hi: number) {
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (fn(mid) > 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

function reference(i: PlanInputs, s: ScenarioKey, includeInss: boolean) {
  const f = factor(i, s);
  const n = Math.round((i.retirementAge - i.currentAge) * 12);
  const m = Math.round((i.horizonAge - i.retirementAge) * 12);
  const need = Math.max(i.desiredMonthlyIncome - (includeInss && i.inssEstimate ? i.inssEstimate : 0), 0);
  const projected = accumulate(i.initialWealth, i.monthlyContribution, f, n);
  const target = presentValue(need, f, m);
  // Aporte que leva o patrimônio exatamente ao alvo (0 se o patrimônio sozinho já basta).
  const required =
    accumulate(i.initialWealth, 0, f, n) >= target ? 0 : bisect((c) => accumulate(i.initialWealth, c, f, n) - target, 0, target + 1);
  // Retirada que zera o patrimônio no horizonte.
  const sustainable = projected <= 0 ? 0 : bisect((p) => -drawdown(projected, p, f, m), 0, projected + 1);
  // Mês em que o dinheiro acaba (retirada inteira no fim do mês); null se dura até o horizonte.
  let depletionMonth: number | null = null;
  let w = projected;
  for (let k = 1; k <= m; k++) {
    w = w * f - need;
    if (w < 0) {
      depletionMonth = k;
      break;
    }
  }
  return { projected, target, required, sustainable, gap: target - projected, depletionMonth };
}

// ---------- cenários gerados com semente fixa ----------
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInputs(r: () => number): PlanInputs {
  const currentAge = 18 + Math.floor(r() * 50);
  const retirementAge = currentAge + 1 + Math.floor(r() * 30);
  const horizonAge = retirementAge + 1 + Math.floor(r() * 30);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  return {
    currentAge,
    retirementAge,
    horizonAge,
    initialWealth: pick([0, 0, 1, 5_000, 120_000, 2_500_000, 100_000_000]),
    monthlyContribution: pick([0, 0, 1, 300, 2_000, 15_000]),
    desiredMonthlyIncome: pick([1, 1_500, 5_000, 12_000, 80_000]),
    inssEstimate: pick([null, 0, 1_412, 4_000]),
    returns: { conservador: pick([-0.05, -0.01, 0, 0.02]), central: pick([0, 0.01, 0.04, 0.07]), otimista: pick([0.06, 0.1, 0.15]) },
    inflationAA: 0.04,
    costsAA: pick([0, 0.005, 0.01, 0.02, 0.099]),
  };
}

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 1e-9);

describe('motor de aposentadoria × implementação de referência (200 cenários)', () => {
  const r = rng(20261102);
  const cases = Array.from({ length: 200 }, () => randomInputs(r));

  it('todos os cenários gerados são válidos', () => {
    for (const i of cases) expect(validateInputs(i)).toEqual([]);
  });

  it('patrimônio projetado, alvo, falta, aporte necessário e renda sustentável batem', () => {
    for (const i of cases)
      for (const s of ['conservador', 'central', 'otimista'] as const)
        for (const inss of [false, true]) {
          const got = simulate(i, s, inss);
          const ref = reference(i, s, inss);
          const ctx = JSON.stringify({ i, s, inss });
          expect(close(got.projectedWealthAtRetirement, ref.projected), `projetado ${ctx}`).toBe(true);
          expect(close(got.targetWealth, ref.target), `alvo ${ctx}`).toBe(true);
          expect(close(got.gap, ref.gap), `falta ${ctx}`).toBe(true);
          expect(Math.abs(got.requiredMonthlyContribution - ref.required) <= Math.max(0.01, ref.required * 1e-6), `aporte ${ctx}`).toBe(true);
          expect(Math.abs(got.sustainableMonthlyIncome - ref.sustainable) <= Math.max(0.01, ref.sustainable * 1e-6), `renda ${ctx}`).toBe(true);
        }
  });

  it('idade em que o dinheiro acaba cai no mesmo mês da simulação mês a mês', () => {
    for (const i of cases) {
      const got = simulate(i, 'central', false);
      const ref = reference(i, 'central', false);
      if (ref.depletionMonth === null) {
        expect(got.depletionAge, JSON.stringify(i)).toBeNull();
      } else if (got.depletionAge !== null) {
        // O motor resolve em meses fracionários; a referência acusa no mês inteiro em que o saldo fica negativo.
        const months = (got.depletionAge - i.retirementAge) * 12;
        expect(months).toBeGreaterThan(ref.depletionMonth - 1 - 1e-9);
        expect(months).toBeLessThanOrEqual(ref.depletionMonth + 1e-9);
      } else {
        // O motor diz que dura até o horizonte: só pode faltar no último mês, por arredondamento.
        expect(ref.depletionMonth).toBeGreaterThanOrEqual(Math.round((i.horizonAge - i.retirementAge) * 12));
      }
    }
  });

  it('série do gráfico bate com a acumulação e o consumo mês a mês', () => {
    for (const i of cases.slice(0, 40)) {
      const f = factor(i, 'central');
      const n = Math.round((i.retirementAge - i.currentAge) * 12);
      const series = projectSeries(i, 'central', false);
      for (const p of series) {
        const k = Math.round((p.age - i.currentAge) * 12);
        let w = i.initialWealth;
        for (let j = 1; j <= k; j++) w = j <= n ? w * f + i.monthlyContribution : Math.max(0, w * f - i.desiredMonthlyIncome);
        expect(close(p.wealth, w), JSON.stringify({ i, age: p.age })).toBe(true);
      }
    }
  });

  it('menor idade para parar: a anterior ainda não fecha e a encontrada fecha', () => {
    for (const i of cases.slice(0, 40)) {
      const e = earliestRetirementAge(i, 'central', false);
      if (!e) continue;
      expect(reference({ ...i, retirementAge: e.age }, 'central', false).gap).toBeLessThanOrEqual(1e-6);
      if (e.monthsFromNow > 1) expect(reference({ ...i, retirementAge: e.age - 1 / 12 }, 'central', false).gap).toBeGreaterThan(0);
    }
  });
});

// ---------- perfis e casos extremos ----------
const base: PlanInputs = {
  currentAge: 30,
  retirementAge: 60,
  horizonAge: 95,
  initialWealth: 0,
  monthlyContribution: 0,
  desiredMonthlyIncome: 5_000,
  inssEstimate: null,
  returns: { conservador: 0.02, central: 0.04, otimista: 0.06 },
  inflationAA: 0.04,
  costsAA: 0,
};

describe('perfis de uso', () => {
  it('jovem sem patrimônio nem aporte: aporte necessário positivo, projetado zero', () => {
    const r = simulate({ ...base, currentAge: 18 }, 'central', false);
    expect(r.projectedWealthAtRetirement).toBe(0);
    expect(r.requiredMonthlyContribution).toBeGreaterThan(0);
    expect(r.depletionAge).toBe(60); // sem nada guardado, o dinheiro acaba já na aposentadoria
  });

  it('meia-idade com patrimônio que já basta: aporte necessário zero e sobra', () => {
    const r = simulate({ ...base, currentAge: 45, initialWealth: 3_000_000 }, 'central', false);
    expect(r.requiredMonthlyContribution).toBe(0);
    expect(r.gap).toBeLessThan(0);
    expect(r.depletionAge).toBeNull();
  });

  it('a um mês de se aposentar: um único aporte cobre a falta', () => {
    const i = { ...base, currentAge: 64, retirementAge: 64 + 1 / 12, initialWealth: 500_000 };
    expect(validateInputs(i)).toEqual([]);
    const r = simulate(i, 'central', false);
    expect(r.monthsToRetirement).toBe(1);
    expect(r.requiredMonthlyContribution).toBeCloseTo(Math.max(0, r.targetWealth - 500_000 * (1 + r.monthlyRate)), 6);
  });

  it('retorno igual ao custo (taxa efetiva zero) usa a conta linear, sem dividir por zero', () => {
    const r = simulate({ ...base, returns: { ...base.returns, central: 0.01 }, costsAA: 0.01, monthlyContribution: 1_000 }, 'central', false);
    expect(Math.abs(r.monthlyRate)).toBeLessThan(1e-12);
    expect(r.projectedWealthAtRetirement).toBeCloseTo(1_000 * 360, 6);
    expect(r.targetWealth).toBeCloseTo(5_000 * 420, 6);
  });

  it('retorno real negativo: o patrimônio encolhe e os números continuam finitos', () => {
    const r = simulate({ ...base, initialWealth: 100_000, returns: { ...base.returns, conservador: -0.05 } }, 'conservador', false);
    expect(r.projectedWealthAtRetirement).toBeLessThan(100_000);
    for (const v of [r.targetWealth, r.requiredMonthlyContribution, r.sustainableMonthlyIncome]) expect(Number.isFinite(v)).toBe(true);
  });

  it('valores muito altos e muito baixos continuam finitos', () => {
    for (const v of [1, 100_000_000]) {
      const r = simulate({ ...base, initialWealth: v, monthlyContribution: v, desiredMonthlyIncome: v }, 'otimista', false);
      for (const x of Object.values(r)) if (typeof x === 'number') expect(Number.isFinite(x)).toBe(true);
    }
  });

  it('mudanças sucessivas nos parâmetros não deixam estado: mesma entrada, mesmo resultado', () => {
    const first = simulate(base, 'central', false);
    simulate({ ...base, currentAge: 50 }, 'central', true);
    simulate({ ...base, monthlyContribution: 9_999 }, 'otimista', false);
    expect(simulate(base, 'central', false)).toEqual(first);
  });
});

describe('validação de entradas', () => {
  const errs = (patch: Partial<PlanInputs>) => validateInputs({ ...base, ...patch });

  it('campos vazios (null vira 0 na tela), negativos e fora da faixa são recusados', () => {
    expect(errs({ desiredMonthlyIncome: 0 })).toHaveLength(1);
    expect(errs({ initialWealth: -1 })).toHaveLength(1);
    expect(errs({ monthlyContribution: -1 })).toHaveLength(1);
    expect(errs({ inssEstimate: -1 })).toHaveLength(1);
    expect(errs({ currentAge: 15 })).toHaveLength(1);
    expect(errs({ retirementAge: 30 })).toHaveLength(1);
    expect(errs({ horizonAge: 60 })).toHaveLength(1);
    expect(errs({ costsAA: 0.1 })).toHaveLength(1);
  });

  it('NaN e Infinity são recusados em todos os campos de valor', () => {
    for (const k of ['initialWealth', 'monthlyContribution', 'desiredMonthlyIncome', 'inssEstimate', 'inflationAA'] as const)
      for (const v of [NaN, Infinity, -Infinity]) expect(errs({ [k]: v }).length, `${k}=${v}`).toBeGreaterThan(0);
  });

  it('inflação absurda é recusada', () => {
    expect(errs({ inflationAA: 0.5 })).toHaveLength(1);
    expect(errs({ inflationAA: -0.2 })).toHaveLength(1);
  });

  it('idades que arredondam para zero mês são recusadas (senão a tela diria "guarde R$ 0")', () => {
    expect(errs({ retirementAge: 30.01 })).toHaveLength(1);
    expect(errs({ horizonAge: 60.01 })).toHaveLength(1);
    expect(errs({ retirementAge: 30 + 1 / 12 })).toEqual([]);
  });

  it('idades e valores acima do plausível são recusados', () => {
    expect(errs({ horizonAge: 130 })).toHaveLength(1);
    expect(errs({ initialWealth: 1e13 })).toHaveLength(1);
  });

  it('retornos fora da faixa geram uma mensagem só', () => {
    expect(errs({ returns: { conservador: 0.5, central: 0.5, otimista: 0.5 } })).toHaveLength(1);
  });
});
