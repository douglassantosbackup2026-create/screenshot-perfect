import { describe, it, expect } from 'vitest';
import { compareRegimes, regressiveRate, validatePensionTax, type PensionTaxInput } from './pensionTax';

describe('regressiveRate', () => {
  it('35% até 2 anos, caindo 5 p.p. a cada 2 anos, 10% acima de 10', () => {
    expect(regressiveRate(1)).toBe(0.35);
    expect(regressiveRate(2)).toBe(0.35);
    expect(regressiveRate(3)).toBe(0.3);
    expect(regressiveRate(9)).toBe(0.15);
    expect(regressiveRate(10)).toBe(0.15);
    expect(regressiveRate(11)).toBe(0.1);
  });
});

const base: PensionTaxInput = {
  annualContribution: 12000,
  years: 20,
  realReturn: 0.04,
  completeReturn: true,
  taxableIncome: 100000,
  marginalRate: 0.275,
  regime: 'regressiva',
  progressiveRate: 0.075,
};

describe('compareRegimes', () => {
  it('declaração simplificada (comum no Simples/MEI): sem dedução, VGBL', () => {
    const r = compareRegimes({ ...base, completeReturn: false });
    expect(r).toMatchObject({ deductible: 0, refundPerYear: 0, winner: 'vgbl', why: 'sem_deducao' });
    expect(r.pgbl.net).toBeCloseTo(r.vgbl.net, 6);
  });

  it('1 ano, sem rendimento, conferido à mão: o IR de 35% sobre o total vence a restituição', () => {
    // VGBL: 12.000, sem rendimento, sem IR. PGBL: 12.000 − 35% = 7.800; restituição 3.300 reinvestida por 0 anos.
    const r = compareRegimes({ ...base, years: 1, realReturn: 0 });
    expect(r.vgbl).toEqual({ gross: 12000, tax: 0, net: 12000 });
    expect(r.pgbl.gross).toBeCloseTo(15300, 6);
    expect(r.pgbl.tax).toBeCloseTo(4200, 6);
    expect(r.pgbl.net).toBeCloseTo(11100, 6);
    expect(r.winner).toBe('vgbl');
    expect(r.why).toBe('imposto_no_total_pesa');
  });

  it('declaração completa, 27,5% hoje e 20 anos na regressiva (10%): PGBL', () => {
    const r = compareRegimes(base);
    expect(r.deductible).toBe(12000);
    expect(r.refundPerYear).toBeCloseTo(3300, 6);
    expect(r.winner).toBe('pgbl');
    expect(r.pgbl.net).toBeGreaterThan(r.vgbl.net);
  });

  it('o que passa de 12% da renda vai para o VGBL', () => {
    const r = compareRegimes({ ...base, taxableIncome: 50000 }); // limite 6.000
    expect(r.deductible).toBe(6000);
    expect(r.refundPerYear).toBeCloseTo(1650, 6);
  });

  it('valida as entradas', () => {
    expect(validatePensionTax({ ...base, years: 0 })).toHaveLength(1);
    expect(validatePensionTax({ ...base, marginalRate: 0.3 })).toHaveLength(1);
    expect(() => compareRegimes({ ...base, annualContribution: 0 })).toThrow();
  });
});
