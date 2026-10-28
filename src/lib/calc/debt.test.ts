import { describe, it, expect } from 'vitest';
import { monthsToPayoff, payoffVsInvest, realAnnualCost } from './debt';

describe('realAnnualCost', () => {
  it('3% ao mês com 4,5% de inflação: cerca de 36% reais ao ano', () => {
    // 1,03^12 = 1,42576; ÷ 1,045 = 1,36437
    expect(realAnnualCost(0.03, 0.045)).toBeCloseTo(0.36437, 4);
  });
  it('sem juros, o custo real é negativo (a inflação come a dívida)', () => {
    expect(realAnnualCost(0, 0.045)).toBeCloseTo(-0.04306, 4);
  });
});

describe('payoffVsInvest', () => {
  it('cartão ou cheque especial: quitar primeiro', () => {
    expect(payoffVsInvest(0.03, 0.045, 0.04).verdict).toBe('quitar');
  });
  it('financiamento barato (0,5% a.m.): investir rende mais', () => {
    const r = payoffVsInvest(0.005, 0.045, 0.04);
    expect(r.realCost).toBeCloseTo(0.01597, 4);
    expect(r.verdict).toBe('investir');
  });
  it('diferença de até 1 p.p.: tanto faz', () => {
    // 0,7% a.m. → 1,0873/1,045 − 1 ≈ 4,05%
    expect(payoffVsInvest(0.007, 0.045, 0.04).verdict).toBe('tanto_faz');
  });
});

describe('monthsToPayoff', () => {
  it('R$ 10.000 a 2% a.m. pagando R$ 500: 26 meses', () => {
    // n = −ln(1 − 0,02·10000/500)/ln(1,02) = −ln(0,6)/ln(1,02) ≈ 25,8
    expect(monthsToPayoff(10000, 0.02, 500)).toBe(26);
  });
  it('parcela menor que os juros: nunca quita', () => {
    expect(monthsToPayoff(10000, 0.03, 300)).toBeNull();
  });
  it('sem juros, divide; sem saldo, zero', () => {
    expect(monthsToPayoff(1000, 0, 300)).toBe(4);
    expect(monthsToPayoff(0, 0.02, 100)).toBe(0);
  });
});
