import { describe, it, expect } from 'vitest';
import { averageMonthlySpending, emergencyFund } from './reserve';

describe('averageMonthlySpending', () => {
  it('média dos meses pedidos; mês sem gasto conta como zero', () => {
    const items = [
      { date: '2026-07-10', amount: -300000 },
      { date: '2026-08-10', amount: -300000 },
      { date: '2026-08-12', amount: 0 },
      { date: '2026-10-10', amount: -999999 }, // fora da janela
    ];
    expect(averageMonthlySpending(items, ['2026-07-01', '2026-08-01', '2026-09-01'])).toBe(200000);
    expect(averageMonthlySpending(items, [])).toBe(0);
  });
});

describe('emergencyFund', () => {
  it('6 meses do custo essencial; quanto falta e quantos meses cobre', () => {
    const r = emergencyFund(300000, 750000);
    expect(r.target).toBe(1800000);
    expect(r.missing).toBe(1050000);
    expect(r.pct).toBeCloseTo(750000 / 1800000);
    expect(r.monthsCovered).toBe(2.5);
  });
  it('passou da meta: falta zero e o progresso para em 100%', () => {
    const r = emergencyFund(100000, 900000);
    expect(r.missing).toBe(0);
    expect(r.pct).toBe(1);
    expect(r.monthsCovered).toBe(9);
  });
  it('sem custo essencial conhecido, não inventa meta', () => {
    expect(emergencyFund(0, 50000)).toMatchObject({ target: 0, pct: 0, monthsCovered: 0 });
  });
});
