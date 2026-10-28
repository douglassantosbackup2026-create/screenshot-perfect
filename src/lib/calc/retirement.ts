// Motor de cálculo de aposentadoria — versão calc-1.1.0
// Funções puras. Todos os valores em reais de hoje (termos reais), exceto quando indicado.
// Convenções: aportes e retiradas no fim de cada mês; taxa mensal equivalente composta.

export const ENGINE_VERSION = 'calc-1.1.0';

export type ScenarioKey = 'conservador' | 'central' | 'otimista';
export const SCENARIOS: ScenarioKey[] = ['conservador', 'central', 'otimista'];

export type PlanInputs = {
  currentAge: number;            // idade atual em anos completos
  retirementAge: number;         // idade desejada para se aposentar
  horizonAge: number;            // idade até a qual o dinheiro deve durar (padrão 95)
  initialWealth: number;         // patrimônio já reservado para a aposentadoria, R$ de hoje
  monthlyContribution: number;   // aporte mensal atual, R$ de hoje
  desiredMonthlyIncome: number;  // renda mensal desejada, R$ de hoje
  inssEstimate: number | null;   // estimativa do Meu INSS informada pelo usuário, R$ de hoje
  returns: Record<ScenarioKey, number>; // retorno REAL anual por cenário (ex.: 0.04 = 4%)
  inflationAA: number;           // inflação anual, usada só para exibir valores nominais
  costsAA: number;               // custo anual informado (ex.: 0.01 = 1%)
}

export type ScenarioResult = {
  engineVersion: string;
  scenario: ScenarioKey;
  includeInss: boolean;
  effectiveRealReturnAA: number;
  monthlyRate: number;
  monthsToRetirement: number;
  retirementMonths: number;
  projectedWealthAtRetirement: number;
  fvFromInitial: number;         // parte do patrimônio projetado que vem do patrimônio inicial
  fvFromContributions: number;   // parte que vem dos aportes mensais
  projectedWealthNominal: number;
  incomeNeededFromWealth: number;
  targetWealth: number;
  gap: number;
  requiredMonthlyContribution: number;
  sustainableMonthlyIncome: number;
  depletionAge: number | null;
  coverageRatio: number;
}

const EPS = 1e-12;

export function effectiveRealReturn(realReturnAA: number, costsAA: number): number {
  return (1 + realReturnAA) / (1 + costsAA) - 1;
}

export function monthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

export function futureValue(initial: number, monthly: number, rm: number, months: number): number {
  if (Math.abs(rm) < EPS) return initial + monthly * months;
  const g = Math.pow(1 + rm, months);
  return initial * g + monthly * ((g - 1) / rm);
}

export function annuityPresentValue(monthlyWithdrawal: number, rm: number, months: number): number {
  if (monthlyWithdrawal <= 0 || months <= 0) return 0;
  if (Math.abs(rm) < EPS) return monthlyWithdrawal * months;
  return monthlyWithdrawal * (1 - Math.pow(1 + rm, -months)) / rm;
}

export function requiredContribution(target: number, initial: number, rm: number, months: number): number {
  if (months <= 0) return 0;
  if (Math.abs(rm) < EPS) return Math.max(0, (target - initial) / months);
  const g = Math.pow(1 + rm, months);
  return Math.max(0, (target - initial * g) * rm / (g - 1));
}

export function sustainableIncome(wealth: number, rm: number, months: number): number {
  if (wealth <= 0 || months <= 0) return 0;
  if (Math.abs(rm) < EPS) return wealth / months;
  return wealth * rm / (1 - Math.pow(1 + rm, -months));
}

// Idade em que o patrimônio acaba se a pessoa retirar `withdrawal` por mês a partir da aposentadoria.
// Retorna null se o dinheiro dura até o horizonte.
export function depletionAge(wealth: number, withdrawal: number, rm: number, retirementAge: number, horizonAge: number): number | null {
  if (withdrawal <= 0) return null;
  let months: number;
  if (Math.abs(rm) < EPS) {
    months = wealth / withdrawal;
  } else {
    const x = (wealth * rm) / withdrawal;
    if (x >= 1) return null; // os rendimentos cobrem a retirada
    months = -Math.log(1 - x) / Math.log(1 + rm);
  }
  const age = retirementAge + months / 12;
  return age >= horizonAge ? null : age;
}

export function validateInputs(i: PlanInputs): string[] {
  const e: string[] = [];
  if (!(i.currentAge >= 16 && i.currentAge <= 90)) e.push('Informe uma idade atual entre 16 e 90 anos.');
  if (!(i.retirementAge > i.currentAge)) e.push('A idade de aposentadoria precisa ser maior que a idade atual.');
  if (!(i.horizonAge > i.retirementAge)) e.push('O horizonte precisa ser maior que a idade de aposentadoria.');
  if (!(i.desiredMonthlyIncome > 0)) e.push('Informe a renda mensal desejada.');
  if (i.initialWealth < 0 || i.monthlyContribution < 0) e.push('Valores não podem ser negativos.');
  if (i.inssEstimate !== null && i.inssEstimate < 0) e.push('A estimativa do INSS não pode ser negativa.');
  for (const k of SCENARIOS) {
    if (!(i.returns[k] >= -0.05 && i.returns[k] <= 0.15)) e.push('Use retornos reais entre -5% e 15% ao ano.');
  }
  if (!(i.costsAA >= 0 && i.costsAA < 0.1)) e.push('Use um custo anual entre 0% e 10%.');
  return e;
}

export function simulate(i: PlanInputs, scenario: ScenarioKey, includeInss: boolean): ScenarioResult {
  const eff = effectiveRealReturn(i.returns[scenario], i.costsAA);
  const rm = monthlyRate(eff);
  const n = Math.round((i.retirementAge - i.currentAge) * 12);
  const m = Math.round((i.horizonAge - i.retirementAge) * 12);
  const fromInitial = futureValue(i.initialWealth, 0, rm, n);
  const fromContributions = futureValue(0, i.monthlyContribution, rm, n);
  const projected = fromInitial + fromContributions;
  const inss = includeInss && i.inssEstimate ? i.inssEstimate : 0;
  const need = Math.max(i.desiredMonthlyIncome - inss, 0);
  const target = annuityPresentValue(need, rm, m);
  return {
    engineVersion: ENGINE_VERSION,
    scenario,
    includeInss,
    effectiveRealReturnAA: eff,
    monthlyRate: rm,
    monthsToRetirement: n,
    retirementMonths: m,
    projectedWealthAtRetirement: projected,
    fvFromInitial: fromInitial,
    fvFromContributions: fromContributions,
    projectedWealthNominal: projected * Math.pow(1 + i.inflationAA, n / 12),
    incomeNeededFromWealth: need,
    targetWealth: target,
    gap: target - projected,
    requiredMonthlyContribution: requiredContribution(target, i.initialWealth, rm, n),
    sustainableMonthlyIncome: sustainableIncome(projected, rm, m),
    depletionAge: depletionAge(projected, need, rm, i.retirementAge, i.horizonAge),
    coverageRatio: target > 0 ? projected / target : 1,
  };
}

export function simulateAll(i: PlanInputs) {
  const semInss = Object.fromEntries(SCENARIOS.map(s => [s, simulate(i, s, false)])) as Record<ScenarioKey, ScenarioResult>;
  const comInss = i.inssEstimate && i.inssEstimate > 0
    ? Object.fromEntries(SCENARIOS.map(s => [s, simulate(i, s, true)])) as Record<ScenarioKey, ScenarioResult>
    : null;
  return { engineVersion: ENGINE_VERSION, semInss, comInss };
}

export type SensitivityItem = {
  key: string;
  label: string;
  deltaSustainableIncome: number; // variação da renda sustentável, R$ de hoje por mês
  deltaGap: number;               // variação da diferença até o patrimônio necessário
}

// Quanto o resultado muda ao alterar uma variável por vez, mantendo as demais.
// Ordenado pelo impacto absoluto na renda sustentável.
export function sensitivity(i: PlanInputs, scenario: ScenarioKey, includeInss: boolean): SensitivityItem[] {
  const base = simulate(i, scenario, includeInss);
  const r = i.returns[scenario];
  const variants: { key: string; label: string; inputs: PlanInputs }[] = [
    { key: 'idade+2', label: 'Aposentar 2 anos depois', inputs: { ...i, retirementAge: Math.min(i.retirementAge + 2, i.horizonAge - 1) } },
    { key: 'idade-2', label: 'Aposentar 2 anos antes', inputs: { ...i, retirementAge: Math.max(i.retirementAge - 2, i.currentAge + 1) } },
    { key: 'aporte+20', label: 'Aporte 20% maior', inputs: { ...i, monthlyContribution: i.monthlyContribution * 1.2 } },
    { key: 'aporte-20', label: 'Aporte 20% menor', inputs: { ...i, monthlyContribution: i.monthlyContribution * 0.8 } },
    { key: 'retorno+1', label: 'Retorno real 1 p.p. maior', inputs: { ...i, returns: { ...i.returns, [scenario]: r + 0.01 } } },
    { key: 'retorno-1', label: 'Retorno real 1 p.p. menor', inputs: { ...i, returns: { ...i.returns, [scenario]: r - 0.01 } } },
    { key: 'custo+0.5', label: 'Custos 0,5 p.p. maiores', inputs: { ...i, costsAA: i.costsAA + 0.005 } },
  ];
  return variants
    .map(({ key, label, inputs }) => {
      const v = simulate(inputs, scenario, includeInss);
      return {
        key,
        label,
        deltaSustainableIncome: v.sustainableMonthlyIncome - base.sustainableMonthlyIncome,
        deltaGap: v.gap - base.gap,
      };
    })
    .sort((a, b) => Math.abs(b.deltaSustainableIncome) - Math.abs(a.deltaSustainableIncome));
}

// Série anual para o gráfico: acumulação até a aposentadoria e consumo até o horizonte.
export function projectSeries(i: PlanInputs, scenario: ScenarioKey, includeInss: boolean): { age: number; wealth: number }[] {
  const rm = monthlyRate(effectiveRealReturn(i.returns[scenario], i.costsAA));
  const inss = includeInss && i.inssEstimate ? i.inssEstimate : 0;
  const need = Math.max(i.desiredMonthlyIncome - inss, 0);
  const points: { age: number; wealth: number }[] = [{ age: i.currentAge, wealth: i.initialWealth }];
  let w = i.initialWealth;
  const totalMonths = Math.round((i.horizonAge - i.currentAge) * 12);
  const retireAt = Math.round((i.retirementAge - i.currentAge) * 12);
  for (let k = 1; k <= totalMonths; k++) {
    w = w * (1 + rm);
    w = k <= retireAt ? w + i.monthlyContribution : Math.max(0, w - need);
    if (k % 12 === 0) points.push({ age: i.currentAge + k / 12, wealth: w });
  }
  return points;
}

export type EarliestRetirement = {
  age: number;              // idade, com fração de mês (ex.: 58.25 = 58 anos e 3 meses)
  monthsFromNow: number;
  result: ScenarioResult;   // simulação nessa idade
}

// Menor idade em que o patrimônio projetado já paga a renda desejada até o horizonte,
// mantendo o aporte de hoje. Busca mês a mês: o patrimônio projetado cresce e o alvo
// diminui com a idade, então a primeira idade que fecha é a resposta.
// Retorna null se nenhuma idade antes do horizonte fecha a conta.
export function earliestRetirementAge(i: PlanInputs, scenario: ScenarioKey, includeInss: boolean): EarliestRetirement | null {
  const last = Math.round((i.horizonAge - i.currentAge) * 12) - 1;
  for (let k = 1; k <= last; k++) {
    const age = i.currentAge + k / 12;
    const result = simulate({ ...i, retirementAge: age }, scenario, includeInss);
    if (result.gap <= 0) return { age, monthsFromNow: k, result };
  }
  return null;
}

export type ScenarioDelta = {
  requiredMonthlyContribution: number;
  projectedWealthAtRetirement: number;
  targetWealth: number;
  sustainableMonthlyIncome: number;
  gap: number;
  coverageRatio: number;
}

// Diferença entre um cenário "E se…?" e o plano base (cenário − base), na mesma régua do simulate().
export function scenarioDelta(base: ScenarioResult, variant: ScenarioResult): ScenarioDelta {
  return {
    requiredMonthlyContribution: variant.requiredMonthlyContribution - base.requiredMonthlyContribution,
    projectedWealthAtRetirement: variant.projectedWealthAtRetirement - base.projectedWealthAtRetirement,
    targetWealth: variant.targetWealth - base.targetWealth,
    sustainableMonthlyIncome: variant.sustainableMonthlyIncome - base.sustainableMonthlyIncome,
    gap: variant.gap - base.gap,
    coverageRatio: variant.coverageRatio - base.coverageRatio,
  };
}
