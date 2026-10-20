import { describe, it, expect } from 'vitest';
import { adjustWeekend, dueOccurrences, nextOccurrence, nominalDate, occurrencesUntil, validateRule, type RecurrenceRule } from './recurring';

const monthly = (startDate: string, extra: Partial<RecurrenceRule> = {}): RecurrenceRule => ({
  startDate, frequency: 'mensal', interval: 1, endDate: null, weekend: 'manter', ...extra,
});

describe('datas das ocorrências', () => {
  it('dia 31 vira o último dia do mês e volta a 31 quando dá', () => {
    const r = monthly('2026-01-31');
    expect([0, 1, 2, 3].map((k) => nominalDate(r, k))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(nominalDate(monthly('2027-12-31'), 2)).toBe('2028-02-29');
  });

  it('semanal e anual com intervalo', () => {
    expect(nominalDate({ ...monthly('2026-10-05'), frequency: 'semanal', interval: 2 }, 3)).toBe('2026-11-16');
    expect(nominalDate({ ...monthly('2028-02-29'), frequency: 'anual' }, 1)).toBe('2029-02-28');
  });

  it('fim de semana vai para sexta ou segunda', () => {
    // 2026-10-10 é sábado; 2026-10-11, domingo
    expect(adjustWeekend('2026-10-10', 'antes')).toBe('2026-10-09');
    expect(adjustWeekend('2026-10-10', 'depois')).toBe('2026-10-12');
    expect(adjustWeekend('2026-10-11', 'antes')).toBe('2026-10-09');
    expect(adjustWeekend('2026-10-11', 'depois')).toBe('2026-10-12');
    expect(adjustWeekend('2026-10-11', 'manter')).toBe('2026-10-11');
  });

  it('inclui a ocorrência de sábado antecipada para sexta', () => {
    const r = monthly('2026-09-10', { weekend: 'antes' });
    expect(occurrencesUntil(r, '2026-10-09')).toEqual([
      { occurrenceDate: '2026-09-10', date: '2026-09-10' },
      { occurrenceDate: '2026-10-10', date: '2026-10-09' },
    ]);
  });

  it('respeita a data final', () => {
    expect(occurrencesUntil(monthly('2026-01-05', { endDate: '2026-03-01' }), '2026-12-31').map((o) => o.date)).toEqual(['2026-01-05', '2026-02-05']);
    expect(nextOccurrence(monthly('2026-01-05', { endDate: '2026-03-01' }), '2026-02-05')).toBeNull();
  });
});

describe('ocorrências vencidas', () => {
  it('rodar duas vezes não duplica', () => {
    const r = monthly('2026-08-05');
    const first = dueOccurrences(r, new Set(), '2026-10-20');
    expect(first.map((o) => o.occurrenceDate)).toEqual(['2026-08-05', '2026-09-05', '2026-10-05']);
    expect(dueOccurrences(r, new Set(first.map((o) => o.occurrenceDate)), '2026-10-20')).toEqual([]);
  });

  it('próxima ocorrência depois de hoje', () => {
    expect(nextOccurrence(monthly('2026-08-05'), '2026-10-20')).toEqual({ occurrenceDate: '2026-11-05', date: '2026-11-05' });
  });

  it('valida a regra', () => {
    expect(validateRule(monthly('2026-08-05'))).toEqual([]);
    expect(validateRule(monthly('2026-08-05', { interval: 0 }))).toHaveLength(1);
    expect(validateRule(monthly('2026-08-05', { endDate: '2026-01-01' }))).toHaveLength(1);
  });
});
