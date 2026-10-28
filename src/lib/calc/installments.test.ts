import { describe, it, expect } from 'vitest';
import { committedByMonth, installmentAt, installmentRule, installmentSchedule, validateInstallments } from './installments';
import { occurrencesUntil } from './recurring';

describe('installmentSchedule', () => {
  it('1.000 em 3x: os centavos que sobram vão na primeira', () => {
    const s = installmentSchedule(100000, 3, '2026-10-15');
    expect(s.map((i) => i.amount)).toEqual([33334, 33333, 33333]);
    expect(s.reduce((t, i) => t + i.amount, 0)).toBe(100000);
    expect(s.map((i) => i.occurrenceDate)).toEqual(['2026-10-15', '2026-11-15', '2026-12-15']);
  });
  it('dia 31 vira o último dia dos meses mais curtos', () => {
    expect(installmentSchedule(30000, 3, '2026-01-31').map((i) => i.occurrenceDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
  it('aceita de 2 a 60 parcelas', () => {
    expect(validateInstallments(100000, 60)).toEqual([]);
    expect(validateInstallments(100000, 61)).toHaveLength(1);
    expect(validateInstallments(100000, 1)).toHaveLength(1);
    expect(() => installmentSchedule(100000, 61, '2026-10-15')).toThrow();
  });
});

describe('installmentRule', () => {
  it('a recorrência gera exatamente as N parcelas', () => {
    const rule = installmentRule('2026-10-15', 10);
    expect(occurrencesUntil(rule, '2030-01-01')).toHaveLength(10);
    expect(rule.endDate).toBe('2027-07-15');
  });
});

describe('installmentAt', () => {
  it('encontra o número e o valor da parcela pela data nominal', () => {
    expect(installmentAt(100000, 3, '2026-10-15', '2026-11-15')).toEqual({ number: 2, occurrenceDate: '2026-11-15', amount: 33333 });
    expect(installmentAt(100000, 3, '2026-10-15', '2027-01-15')).toBeNull();
  });
});

describe('committedByMonth', () => {
  it('soma só as parcelas depois de hoje, mês a mês', () => {
    const items = installmentSchedule(100000, 3, '2026-10-15').map((i) => ({ date: i.occurrenceDate, amount: i.amount }));
    expect(committedByMonth(items, '2026-10-20', 4)).toEqual([
      { month: '2026-10-01', amount: 0 },
      { month: '2026-11-01', amount: 33333 },
      { month: '2026-12-01', amount: 33333 },
      { month: '2027-01-01', amount: 0 },
    ]);
  });
});
