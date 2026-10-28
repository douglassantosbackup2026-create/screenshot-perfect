// Vale a pena quitar a dívida? Compara o custo real da dívida com o retorno real que o plano espera.
// Funções puras. Taxas em decimal (0,03 = 3% ao mês); custo e retorno reais ao ano, pela equação de Fisher.

/** Custo real ao ano: juros mensais compostos no ano, descontada a inflação. */
export function realAnnualCost(rateMonthly: number, inflationAA: number): number {
  return Math.pow(1 + rateMonthly, 12) / (1 + inflationAA) - 1;
}

export type DebtVerdict = 'quitar' | 'investir' | 'tanto_faz';

export type PayoffComparison = {
  realCost: number;   // ao ano, decimal
  realReturn: number; // ao ano, decimal (o do plano)
  gapPP: number;      // custo − retorno, em pontos percentuais
  verdict: DebtVerdict;
}

/**
 * Quitar ou investir: se a dívida custa mais (real) do que o dinheiro rende no plano, quitar ganha.
 * Até `margin` de diferença (1 p.p.), tanto faz: aí pesa a tranquilidade de não dever.
 */
export function payoffVsInvest(rateMonthly: number, inflationAA: number, realReturnAA: number, margin = 0.01): PayoffComparison {
  const realCost = realAnnualCost(rateMonthly, inflationAA);
  const gap = realCost - realReturnAA;
  return {
    realCost,
    realReturn: realReturnAA,
    gapPP: gap * 100,
    verdict: gap > margin ? 'quitar' : gap < -margin ? 'investir' : 'tanto_faz',
  };
}

/**
 * Meses até quitar pagando `payment` por mês (fórmula da tabela Price).
 * Se a parcela não cobre nem os juros, a dívida nunca acaba: null.
 */
export function monthsToPayoff(balance: number, rateMonthly: number, payment: number): number | null {
  if (balance <= 0) return 0;
  if (payment <= 0) return null;
  if (rateMonthly <= 0) return Math.ceil(balance / payment);
  if (payment <= balance * rateMonthly) return null;
  return Math.ceil(-Math.log(1 - (rateMonthly * balance) / payment) / Math.log(1 + rateMonthly));
}
