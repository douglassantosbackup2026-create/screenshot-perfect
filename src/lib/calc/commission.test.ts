import { describe, it, expect } from 'vitest';
import { addMonths, commissionFor, formatRate, parseRate } from './commission';

const pay = (paidAt: string, previousCount = 0, paymentCents = 3990) => ({
  paymentCents,
  paidAt,
  firstPaidAt: '2026-01-10T12:00:00Z',
  previousCount,
});

describe('commissionFor', () => {
  it('percentual do pagamento, arredondado ao centavo', () => {
    expect(commissionFor({ mode: 'sempre', bp: 2000, months: null }, pay('2026-01-10T12:00:00Z'))).toBe(798);
    expect(commissionFor({ mode: 'sempre', bp: 1250, months: null }, pay('2026-01-10T12:00:00Z', 0, 3990))).toBe(499);
    expect(commissionFor({ mode: 'sempre', bp: 0, months: null }, pay('2026-01-10T12:00:00Z'))).toBe(0);
    expect(commissionFor({ mode: 'sempre', bp: 10000, months: null }, pay('2026-01-10T12:00:00Z'))).toBe(3990);
  });

  it('primeiro: só quando o indicado ainda não gerou comissão', () => {
    const rule = { mode: 'primeiro' as const, bp: 3000, months: null };
    expect(commissionFor(rule, pay('2026-01-10T12:00:00Z', 0))).toBe(1197);
    expect(commissionFor(rule, pay('2026-02-10T12:00:00Z', 1))).toBe(0);
  });

  it('meses: paga dentro da janela contada do primeiro pagamento', () => {
    const rule = { mode: 'meses' as const, bp: 2000, months: 12 };
    expect(commissionFor(rule, pay('2026-12-10T12:00:00Z', 11))).toBe(798);
    expect(commissionFor(rule, pay('2027-01-10T12:00:00Z', 12))).toBe(0);
  });

  it('sempre: não tem fim', () => {
    expect(commissionFor({ mode: 'sempre', bp: 2000, months: null }, pay('2031-01-10T12:00:00Z', 60))).toBe(798);
  });
});

describe('addMonths', () => {
  it('fim de mês vira o último dia do mês final, como o Postgres', () => {
    expect(addMonths('2026-01-31T00:00:00Z', 1).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(addMonths('2026-01-10T12:00:00Z', 12).toISOString()).toBe('2027-01-10T12:00:00.000Z');
  });
});

describe('formatRate / parseRate', () => {
  it('converte entre texto e basis points', () => {
    expect(formatRate(2000)).toBe('20%');
    expect(formatRate(1250)).toBe('12,5%');
    expect(parseRate('12,5')).toBe(1250);
    expect(parseRate('101')).toBeNull();
    expect(parseRate('')).toBeNull();
  });
});
