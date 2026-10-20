import { describe, it, expect } from 'vitest';
import { compoundVsSimple, purchasingPower, savingsOverYears } from './lessons';

const close = (got: number, exp: number, tol = 1) => expect(Math.abs(got - exp)).toBeLessThanOrEqual(tol);

describe('mini simulações das lições', () => {
  it('R$ 500 por mês: bate com os números da lição 1', () => {
    const a = savingsOverYears(500, 0.04, 30);
    expect(a.contributed).toBe(180000);
    close(a.value, 343000, 1500);
    close(savingsOverYears(500, 0.04, 20).value, 182000, 1500);
  });
  it('retorno zero devolve só o aportado', () => {
    expect(savingsOverYears(500, 0, 10)).toEqual({ value: 60000, contributed: 60000 });
  });
  it('poder de compra', () => {
    close(purchasingPower(1000, 0.04, 10), 675.56, 0.01);
    expect(purchasingPower(1000, 0, 10)).toBe(1000);
  });
  it('composto supera simples com o tempo', () => {
    const r = compoundVsSimple(10000, 0.06, 30);
    close(r.compound, 57434.91, 0.01);
    expect(r.simple).toBe(28000);
    expect(compoundVsSimple(10000, 0.06, 0)).toEqual({ compound: 10000, simple: 10000 });
  });
});
