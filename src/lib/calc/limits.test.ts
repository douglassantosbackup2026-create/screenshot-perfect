import { describe, it, expect } from 'vitest';
import { limitUsage, periodRange, validateLimit, type LimitTx } from './limits';

describe('periodRange', () => {
  it('a semana vai de segunda a domingo', () => {
    expect(periodRange('semana', '2026-10-27')).toEqual({ start: '2026-10-26', end: '2026-11-01' }); // terça
    expect(periodRange('semana', '2026-11-01')).toEqual({ start: '2026-10-26', end: '2026-11-01' }); // domingo
    expect(periodRange('semana', '2026-10-26')).toEqual({ start: '2026-10-26', end: '2026-11-01' }); // segunda
  });
  it('a quinzena vai de 1 a 15 e de 16 ao último dia', () => {
    expect(periodRange('quinzena', '2026-10-15')).toEqual({ start: '2026-10-01', end: '2026-10-15' });
    expect(periodRange('quinzena', '2026-10-16')).toEqual({ start: '2026-10-16', end: '2026-10-31' });
    expect(periodRange('quinzena', '2026-02-20')).toEqual({ start: '2026-02-16', end: '2026-02-28' });
  });
  it('dia e mês', () => {
    expect(periodRange('dia', '2026-10-27')).toEqual({ start: '2026-10-27', end: '2026-10-27' });
    expect(periodRange('mes', '2026-11-03')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
  });
});

const tx = (date: string, amount: number, categoryId: string | null, transferId: string | null = null): LimitTx => ({ date, amount, categoryId, transferId });

describe('limitUsage', () => {
  const txs = [
    tx('2026-10-25', -9000, 'rest'), // domingo da semana anterior
    tx('2026-10-26', -15000, 'rest'),
    tx('2026-10-27', -10000, 'rest'),
    tx('2026-10-27', 2000, 'rest'), // estorno
    tx('2026-10-27', -5000, 'mercado'),
    tx('2026-10-27', -50000, null, 'tr1'), // transferência
    tx('2026-10-27', 800000, null), // renda
  ];
  it('Restaurantes R$ 300 por semana: R$ 230 gastos (estorno abate) dá 77% e aviso', () => {
    const u = limitUsage(txs, { categoryId: 'rest', period: 'semana', amount: 30000 }, '2026-10-27');
    expect(u.spent).toBe(23000);
    expect(u.pct).toBeCloseTo(0.7667, 3);
    expect(u.level).toBe('atencao');
  });
  it('no total, só saídas e sem transferências', () => {
    const u = limitUsage(txs, { categoryId: null, period: 'dia', amount: 15000 }, '2026-10-27');
    expect(u.spent).toBe(15000);
    expect(u.level).toBe('limite');
  });
  it('abaixo de 75%, sem aviso', () => {
    expect(limitUsage(txs, { categoryId: 'mercado', period: 'mes', amount: 10000 }, '2026-10-27').level).toBeNull();
  });
  it('valor do limite precisa ser positivo', () => {
    expect(validateLimit({ categoryId: null, period: 'dia', amount: 0 })).toHaveLength(1);
    expect(validateLimit({ categoryId: null, period: 'dia', amount: 100 })).toEqual([]);
  });
});
