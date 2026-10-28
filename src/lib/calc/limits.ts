// Limites de gasto por período (dia, semana, quinzena, mês), por categoria ou no total.
// Funções puras, valores em centavos. Complementam o envelope mensal: o envelope diz quanto há no mês,
// o limite avisa quando o ritmo de um período curto passou do combinado.

import { budgetAlertLevel, type BudgetAlertLevel } from './alerts';
import { addDays } from './recurring';

export type LimitPeriod = 'dia' | 'semana' | 'quinzena' | 'mes';

export const LIMIT_PERIODS: { value: LimitPeriod; label: string; per: string }[] = [
  { value: 'dia', label: 'Dia', per: 'por dia' },
  { value: 'semana', label: 'Semana', per: 'por semana' },
  { value: 'quinzena', label: 'Quinzena', per: 'por quinzena' },
  { value: 'mes', label: 'Mês', per: 'por mês' },
];

const lastDayOfMonth = (date: string) => {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  return `${date.slice(0, 8)}${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

/** Primeiro e último dia do período que contém `today`. A semana vai de segunda a domingo; a quinzena, de 1 a 15 e de 16 ao fim do mês. */
export function periodRange(period: LimitPeriod, today: string): { start: string; end: string } {
  if (period === 'dia') return { start: today, end: today };
  if (period === 'semana') {
    const dow = new Date(today + 'T00:00:00Z').getUTCDay(); // 0 domingo
    const start = addDays(today, -((dow + 6) % 7));
    return { start, end: addDays(start, 6) };
  }
  const first = today.slice(0, 8) + '01';
  if (period === 'mes') return { start: first, end: lastDayOfMonth(today) };
  return Number(today.slice(8, 10)) <= 15
    ? { start: first, end: today.slice(0, 8) + '15' }
    : { start: today.slice(0, 8) + '16', end: lastDayOfMonth(today) };
}

export type LimitTx = {
  date: string;
  amount: number; // centavos, com sinal
  categoryId: string | null;
  transferId: string | null;
}

export type SpendLimitRule = {
  categoryId: string | null; // null = todos os gastos
  period: LimitPeriod;
  amount: number;            // centavos por período
}

export type LimitUsage = {
  start: string;
  end: string;
  spent: number; // centavos positivos
  limit: number;
  pct: number;
  level: BudgetAlertLevel | null; // a partir de 75%, como os envelopes
}

export function validateLimit(l: SpendLimitRule): string[] {
  if (!(Number.isInteger(l.amount) && l.amount > 0)) return ['Informe o valor do limite.'];
  return [];
}

/**
 * Quanto já foi gasto no período atual do limite. Transferências não contam.
 * Numa categoria, estornos abatem o gasto; no total, só entram as saídas.
 */
export function limitUsage(txs: LimitTx[], l: SpendLimitRule, today: string): LimitUsage {
  const { start, end } = periodRange(l.period, today);
  let spent = 0;
  for (const t of txs) {
    if (t.transferId || t.date < start || t.date > end) continue;
    if (l.categoryId === null ? t.amount < 0 : t.categoryId === l.categoryId) spent -= t.amount;
  }
  spent = Math.max(spent, 0);
  return { start, end, spent, limit: l.amount, pct: l.amount > 0 ? spent / l.amount : 0, level: budgetAlertLevel(l.amount, spent) };
}
