// Compras parceladas: o valor de cada parcela e quanto já está comprometido nos próximos meses.
// Funções puras, valores em centavos. A parcela é uma recorrência mensal com fim; esta conta só diz
// quanto vale cada uma (o resto dos centavos vai na primeira, como fazem os cartões).

import { nominalDate, type RecurrenceRule } from './recurring';

export const MAX_INSTALLMENTS = 60;

export type Installment = {
  number: number;         // 1 = primeira
  occurrenceDate: string; // data nominal da parcela
  amount: number;         // centavos positivos
}

export function validateInstallments(total: number, count: number): string[] {
  if (!(Number.isInteger(count) && count >= 2 && count <= MAX_INSTALLMENTS)) return [`O parcelamento vai de 2 a ${MAX_INSTALLMENTS} vezes.`];
  if (!(Number.isInteger(total) && total >= count)) return ['Informe o valor da compra.'];
  return [];
}

/** Regra mensal da compra parcelada: começa em `firstDate` e termina na última parcela. */
export function installmentRule(firstDate: string, count: number): RecurrenceRule {
  const base: RecurrenceRule = { startDate: firstDate, frequency: 'mensal', interval: 1, endDate: null, weekend: 'manter' };
  return { ...base, endDate: nominalDate(base, count - 1) };
}

/** As parcelas da compra. A soma é sempre `total`; os centavos que sobram da divisão vão na primeira. */
export function installmentSchedule(total: number, count: number, firstDate: string): Installment[] {
  const errors = validateInstallments(total, count);
  if (errors.length) throw new Error(errors[0]);
  const base = Math.floor(total / count);
  const rule = installmentRule(firstDate, count);
  return Array.from({ length: count }, (_, k) => ({
    number: k + 1,
    occurrenceDate: nominalDate(rule, k),
    amount: base + (k === 0 ? total - base * count : 0),
  }));
}

/** Qual parcela é a ocorrência de data nominal `occurrenceDate`; null se não for desta compra. */
export function installmentAt(total: number, count: number, firstDate: string, occurrenceDate: string): Installment | null {
  return installmentSchedule(total, count, firstDate).find((i) => i.occurrenceDate === occurrenceDate) ?? null;
}

export type CommittedMonth = {
  month: string;  // "YYYY-MM-01"
  amount: number; // centavos positivos que ainda vão cair
}

/**
 * Quanto das compras parceladas ainda vai cair em cada um dos `months` meses a partir do mês de `after`,
 * contando só parcelas com data depois de `after`. `items` são as parcelas futuras (data e valor positivo).
 */
export function committedByMonth(items: { date: string; amount: number }[], after: string, months: number): CommittedMonth[] {
  const first = after.slice(0, 7);
  const y = Number(first.slice(0, 4));
  const m0 = Number(first.slice(5, 7)) - 1;
  const out: CommittedMonth[] = Array.from({ length: months }, (_, i) => {
    const total = m0 + i;
    const yy = y + Math.floor(total / 12);
    return { month: `${yy}-${String((total % 12) + 1).padStart(2, '0')}-01`, amount: 0 };
  });
  const index = new Map(out.map((c, i) => [c.month.slice(0, 7), i]));
  for (const it of items) {
    if (it.date <= after) continue;
    const i = index.get(it.date.slice(0, 7));
    if (i !== undefined) out[i]!.amount += it.amount;
  }
  return out;
}
