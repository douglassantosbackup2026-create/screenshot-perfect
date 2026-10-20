// Contas das mini simulações das lições. Funções puras, sobre o mesmo motor do plano.
import { futureValue, monthlyRate } from './retirement';

/** Aporte mensal fixo durante `years` anos, com retorno real anual constante. */
export function savingsOverYears(monthly: number, realAA: number, years: number) {
  const months = Math.round(years * 12);
  return { value: futureValue(0, monthly, monthlyRate(realAA), months), contributed: monthly * months };
}

/** Quanto `amount` de hoje compra daqui a `years` anos, com inflação anual constante. */
export function purchasingPower(amount: number, inflationAA: number, years: number): number {
  return amount / Math.pow(1 + inflationAA, years);
}

/** Juros compostos contra juros simples sobre um valor inicial. */
export function compoundVsSimple(initial: number, rateAA: number, years: number) {
  return { compound: initial * Math.pow(1 + rateAA, years), simple: initial * (1 + rateAA * years) };
}
