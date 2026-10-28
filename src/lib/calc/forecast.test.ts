import { describe, it, expect } from 'vitest';
import { monthEndProjection } from './forecast';

describe('monthEndProjection', () => {
  it('saldo de hoje + entradas − saídas agendadas até o fim do mês', () => {
    const p = monthEndProjection(200000, '2026-10-10', '2026-10-31', [
      { date: '2026-10-05', amount: -99999, label: 'já passou' },
      { date: '2026-10-15', amount: -150000, label: 'Aluguel' },
      { date: '2026-10-20', amount: 500000, label: 'Salário' },
      { date: '2026-10-25', amount: -8990, label: 'Streaming' },
      { date: '2026-11-01', amount: -99999, label: 'mês que vem' },
    ]);
    expect(p.inflows).toBe(500000);
    expect(p.outflows).toBe(158990);
    expect(p.projected).toBe(541010);
    expect(p.flows).toHaveLength(3);
    expect(p.lowestPoint).toBe(50000);
    expect(p.lowestDate).toBe('2026-10-15');
  });
  it('mostra o dia em que o saldo fica negativo', () => {
    const p = monthEndProjection(100000, '2026-10-10', '2026-10-31', [
      { date: '2026-10-18', amount: -150000, label: 'Aluguel' },
      { date: '2026-10-28', amount: 300000, label: 'Salário' },
    ]);
    expect(p.lowestPoint).toBe(-50000);
    expect(p.lowestDate).toBe('2026-10-18');
    expect(p.projected).toBe(250000);
  });
  it('entrada e saída no mesmo dia se compensam antes de medir o menor saldo', () => {
    const p = monthEndProjection(0, '2026-10-10', '2026-10-31', [
      { date: '2026-10-15', amount: -50000, label: 'Conta' },
      { date: '2026-10-15', amount: 80000, label: 'Pix' },
    ]);
    expect(p.lowestPoint).toBe(0);
    expect(p.lowestDate).toBe('2026-10-10');
  });
});
