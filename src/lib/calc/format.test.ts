import { describe, it, expect } from 'vitest';
import { formatMonthly, formatWealth, formatPercent, formatAge, formatAgeMonths, formatMoney } from './format';

// Intl usa espaço não separável entre "R$" e o número; normaliza para comparar.
const plain = (s: string) => s.replace(/\s/g, ' ');

describe('formatMonthly', () => {
  it('arredonda para R$ 10, sem centavos', () => {
    expect(plain(formatMonthly(1234))).toBe('R$ 1.230');
    expect(plain(formatMonthly(1235))).toBe('R$ 1.240');
    expect(plain(formatMonthly(0))).toBe('R$ 0');
  });
});

describe('formatWealth', () => {
  it('arredonda para R$ 1.000', () => {
    expect(plain(formatWealth(1_234_567))).toBe('R$ 1.235.000');
    expect(plain(formatWealth(499))).toBe('R$ 0');
  });
});

describe('formatPercent', () => {
  it('uma casa decimal, vírgula brasileira', () => {
    expect(plain(formatPercent(0.0456))).toBe('4,6%');
    expect(plain(formatPercent(1))).toBe('100,0%');
  });
});

describe('formatAge / formatAgeMonths', () => {
  it('idade inteira descarta a fração', () => {
    expect(formatAge(58.9)).toBe('58 anos');
  });
  it('meses no singular e no plural; ano cheio sem meses', () => {
    expect(formatAgeMonths(58.25)).toBe('58 anos e 3 meses');
    expect(formatAgeMonths(58 + 1 / 12)).toBe('58 anos e 1 mês');
    expect(formatAgeMonths(60)).toBe('60 anos');
    expect(formatAgeMonths(59.99)).toBe('60 anos');
  });
});

describe('formatMoney', () => {
  it('valor exato a partir de centavos', () => {
    expect(plain(formatMoney(123456))).toBe('R$ 1.234,56');
    expect(plain(formatMoney(-5050))).toBe('-R$ 50,50');
  });
  it('zero negativo não vira "-R$ 0,00"', () => {
    expect(plain(formatMoney(-0))).toBe('R$ 0,00');
  });
});
