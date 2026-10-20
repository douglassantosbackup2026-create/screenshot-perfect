import { describe, it, expect } from 'vitest';
import { cashFlowSeries, cashFlowTotals, categoryTrend, OTHER_KEY, UNCATEGORIZED_KEY, wealthByGroup } from './reports';
import type { LedgerTx } from './ledger';

const tx = (id: string, date: string, amount: number, categoryId: string | null = null, transferId: string | null = null): LedgerTx => ({
  id, accountId: 'cc', date, amount, categoryId, transferId,
});

const txs: LedgerTx[] = [
  tx('1', '2026-09-05', 800000, 'renda'),
  tx('2', '2026-09-10', -200000, 'moradia'),
  tx('3', '2026-09-12', -60000, 'mercado'),
  tx('4', '2026-09-20', -10000, 'lazer'),
  tx('5', '2026-09-21', -5000, 'saude'),
  tx('6', '2026-09-22', -3000),
  tx('7', '2026-09-25', -100000, null, '8'),
  tx('9', '2026-10-05', 800000, 'renda'),
  tx('10', '2026-10-10', -200000, 'moradia'),
  tx('11', '2026-10-12', -900000, 'mercado'),
];

describe('fluxo de caixa', () => {
  it('entradas, saídas, sobra e taxa de poupança por mês, sem transferências', () => {
    const s = cashFlowSeries(txs, ['2026-08-01', '2026-09-01', '2026-10-01']);
    expect(s[0]).toEqual({ month: '2026-08-01', income: 0, expense: 0, net: 0, savingsRate: null });
    expect(s[1]).toEqual({ month: '2026-09-01', income: 800000, expense: 278000, net: 522000, savingsRate: 522000 / 800000 });
    expect(s[2]!.net).toBe(-300000);
    const t = cashFlowTotals(s);
    expect(t).toMatchObject({ income: 1600000, expense: 1378000, net: 222000, monthsWithSurplus: 1, monthsWithIncome: 2, averageExpense: Math.round(1378000 / 2) });
    expect(t.savingsRate).toBeCloseTo(222000 / 1600000, 10);
  });
});

describe('gastos por categoria', () => {
  it('as maiores ganham cor própria, o resto vai para outros, e a classificação não muda com o período', () => {
    const all = ['2026-09-01', '2026-10-01'];
    const t = categoryTrend(txs, ['2026-10-01'], all, 2);
    expect(t.keys).toEqual(['mercado', 'moradia']);
    expect(t.rows).toEqual([{ month: '2026-10-01', mercado: 900000, moradia: 200000 }]);
    const sep = categoryTrend(txs, ['2026-09-01'], all, 2);
    expect(sep.keys).toEqual(['mercado', 'moradia', OTHER_KEY]);
    expect(sep.rows[0]).toEqual({ month: '2026-09-01', mercado: 60000, moradia: 200000, [OTHER_KEY]: 18000 });
  });

  it('gasto sem categoria tem chave própria', () => {
    const t = categoryTrend([tx('a', '2026-09-01', -500)], ['2026-09-01'], ['2026-09-01']);
    expect(t.keys).toEqual([UNCATEGORIZED_KEY]);
  });
});

describe('patrimônio por grupo', () => {
  it('mês sem registro repete o último valor; antes do primeiro, zero; dívidas ficam de fora', () => {
    const rows = wealthByGroup(
      [
        { id: 'p', category: 'pgbl' },
        { id: 'r', category: 'reserva' },
        { id: 'd', category: 'divida' },
      ],
      [
        { assetId: 'p', month: '2026-08-01', value: 1000 },
        { assetId: 'p', month: '2026-10-01', value: 1500 },
        { assetId: 'r', month: '2026-09-01', value: 300 },
        { assetId: 'd', month: '2026-08-01', value: 999 },
      ],
      ['2026-08-01', '2026-09-01', '2026-10-01'],
    );
    expect(rows.map((r) => [r.previdencia, r.reserva, r.outros])).toEqual([
      [1000, 0, 0],
      [1000, 300, 0],
      [1500, 300, 0],
    ]);
  });
});
