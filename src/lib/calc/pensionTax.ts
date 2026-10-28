// PGBL ou VGBL? Calculadora educativa da tributação da previdência privada. Funções puras, valores em R$ de hoje.
// Regras (Lei 11.053/2004 para a tabela regressiva; dedução do PGBL limitada a 12% da renda tributável):
// - PGBL: abate até 12% da renda tributável no IR do ano, só na declaração completa. No resgate, o IR cai sobre o total.
// - VGBL: não abate nada. No resgate, o IR cai só sobre o rendimento.
// - Regressiva: a alíquota cai com o tempo de cada aporte. Progressiva: usa-se uma alíquota efetiva informada.
// Simplificações declaradas: aportes no início de cada ano; a restituição do PGBL é reinvestida no ano seguinte
// no mesmo retorno, tributada como VGBL; o que passa de 12% vai para o VGBL (é o que se recomenda fazer).

export const REGRESSIVE_TABLE: { upToYears: number; rate: number }[] = [
  { upToYears: 2, rate: 0.35 },
  { upToYears: 4, rate: 0.3 },
  { upToYears: 6, rate: 0.25 },
  { upToYears: 8, rate: 0.2 },
  { upToYears: 10, rate: 0.15 },
  { upToYears: Infinity, rate: 0.1 },
];
export const PGBL_DEDUCTION_LIMIT = 0.12;
export const MARGINAL_RATES = [0, 0.075, 0.15, 0.225, 0.275];

/** Alíquota da tabela regressiva para um aporte mantido por `years` anos. */
export function regressiveRate(years: number): number {
  return REGRESSIVE_TABLE.find((r) => years <= r.upToYears)!.rate;
}

export type PensionTaxInput = {
  annualContribution: number;  // R$ por ano
  years: number;               // anos até o resgate (inteiro, ≥ 1)
  realReturn: number;          // ao ano, decimal
  completeReturn: boolean;     // faz a declaração completa do IR
  taxableIncome: number;       // renda bruta tributável por ano, R$
  marginalRate: number;        // alíquota marginal do IR hoje (0 a 0,275)
  regime: 'regressiva' | 'progressiva';
  progressiveRate: number;     // alíquota efetiva esperada no resgate, se progressiva
}

export type ProductResult = {
  gross: number; // R$ acumulados antes do IR do resgate
  tax: number;   // IR no resgate
  net: number;   // o que fica
}

export type PensionTaxComparison = {
  deductible: number;          // R$ por ano que vão para o PGBL (o resto vai para o VGBL)
  refundPerYear: number;       // restituição anual do PGBL
  vgbl: ProductResult;         // tudo no VGBL
  pgbl: ProductResult;         // PGBL até 12% + VGBL no resto + restituição reinvestida
  winner: 'pgbl' | 'vgbl' | 'empate';
  why: 'sem_deducao' | 'restituicao_compensa' | 'imposto_no_total_pesa' | 'diferenca_pequena';
}

export function validatePensionTax(i: PensionTaxInput): string[] {
  if (!(i.annualContribution > 0)) return ['Informe quanto aporta por ano.'];
  if (!(Number.isInteger(i.years) && i.years >= 1 && i.years <= 60)) return ['Os anos até o resgate vão de 1 a 60.'];
  if (!(i.marginalRate >= 0 && i.marginalRate <= 0.275)) return ['A alíquota do IR vai de 0% a 27,5%.'];
  if (!(i.progressiveRate >= 0 && i.progressiveRate <= 0.275)) return ['A alíquota no resgate vai de 0% a 27,5%.'];
  if (!(i.taxableIncome >= 0)) return ['Informe a renda tributável.'];
  return [];
}

export function compareRegimes(i: PensionTaxInput): PensionTaxComparison {
  const errors = validatePensionTax(i);
  if (errors.length) throw new Error(errors[0]);
  const n = i.years;
  const grow = (v: number, held: number) => v * Math.pow(1 + i.realReturn, held);
  const rateFor = (held: number) => (i.regime === 'regressiva' ? regressiveRate(held) : i.progressiveRate);
  const deductible = i.completeReturn ? Math.min(i.annualContribution, PGBL_DEDUCTION_LIMIT * i.taxableIncome) : 0;
  const refundPerYear = deductible * i.marginalRate;

  const vgbl: ProductResult = { gross: 0, tax: 0, net: 0 };
  const pgbl: ProductResult = { gross: 0, tax: 0, net: 0 };
  const addVgbl = (target: ProductResult, amount: number, held: number) => {
    const fv = grow(amount, held);
    target.gross += fv;
    target.tax += rateFor(held) * Math.max(fv - amount, 0);
  };
  for (let k = 0; k < n; k++) {
    const held = n - k; // aporte no início do ano k, resgate no fim do ano n
    addVgbl(vgbl, i.annualContribution, held);
    // PGBL: imposto sobre tudo no resgate.
    const fv = grow(deductible, held);
    pgbl.gross += fv;
    pgbl.tax += rateFor(held) * fv;
    addVgbl(pgbl, i.annualContribution - deductible, held);
    // A restituição chega no ano seguinte e é reinvestida (tributada só no rendimento).
    if (refundPerYear > 0) addVgbl(pgbl, refundPerYear, held - 1);
  }
  vgbl.net = vgbl.gross - vgbl.tax;
  pgbl.net = pgbl.gross - pgbl.tax;

  if (deductible === 0) return { deductible, refundPerYear, vgbl, pgbl, winner: 'vgbl', why: 'sem_deducao' };
  const diff = pgbl.net - vgbl.net;
  if (Math.abs(diff) < 0.005 * vgbl.net) return { deductible, refundPerYear, vgbl, pgbl, winner: 'empate', why: 'diferenca_pequena' };
  return diff > 0
    ? { deductible, refundPerYear, vgbl, pgbl, winner: 'pgbl', why: 'restituicao_compensa' }
    : { deductible, refundPerYear, vgbl, pgbl, winner: 'vgbl', why: 'imposto_no_total_pesa' };
}

/** Valores iniciais a partir do plano: aporte anual, anos até a aposentadoria e retorno real central. */
export function pensionTaxDefaults(p: { monthlyContribution: number; currentAge: number; retirementAge: number; returns: { central: number } }): Pick<
  PensionTaxInput,
  'annualContribution' | 'years' | 'realReturn'
> {
  return {
    annualContribution: Math.round(p.monthlyContribution * 12),
    years: Math.min(Math.max(p.retirementAge - p.currentAge, 1), 60),
    realReturn: p.returns.central,
  };
}
