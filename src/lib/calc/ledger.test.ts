import { describe, it, expect } from 'vitest';
import { accountBalances, groupByDay, monthSummary, spendingByCategory, toCents, type LedgerTx } from './ledger';

const tx = (id: string, date: string, amount: number, categoryId: string | null = null, transferId: string | null = null, accountId = 'cc'): LedgerTx => ({
  id, accountId, date, amount, categoryId, transferId,
});

const txs: LedgerTx[] = [
  tx('1', '2026-10-01', 800000, 'renda'),
  tx('2', '2026-10-03', -150000, 'moradia'),
  tx('3', '2026-10-03', -45090, 'mercado'),
  tx('4', '2026-10-05', 5000, 'mercado'), // estorno
  tx('5', '2026-10-10', -100000, null, '6'),
  tx('6', '2026-10-10', 100000, null, '5', 'prev'),
  tx('7', '2026-09-28', -20000, 'mercado'),
];

describe('livro-caixa', () => {
  it('converte reais em centavos sem erro de arredondamento', () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(1234.565)).toBe(123457);
  });

  it('saldo por conta soma o saldo inicial e os lançamentos até a data', () => {
    const b = accountBalances([{ id: 'cc', openingBalance: 300000 }, { id: 'prev', openingBalance: 0 }], txs);
    expect(b).toEqual({ cc: 300000 + 800000 - 150000 - 45090 + 5000 - 100000 - 20000, prev: 100000 });
    expect(accountBalances([{ id: 'cc', openingBalance: 0 }], txs, '2026-09-30')).toEqual({ cc: -20000 });
  });

  it('o resumo do mês ignora transferências e outros meses', () => {
    expect(monthSummary(txs, '2026-10-01')).toEqual({ income: 805000, expense: 195090, net: 609910, count: 4 });
  });

  it('gastos por categoria descontam estornos e somam 1', () => {
    const c = spendingByCategory(txs, '2026-10-01');
    expect(c.map((x) => [x.categoryId, x.amount])).toEqual([
      ['moradia', 150000],
      ['mercado', 40090],
    ]);
    expect(c.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 10);
  });

  it('agrupa por dia, do mais recente, sem contar transferências no total do dia', () => {
    const g = groupByDay(txs.filter((t) => t.date >= '2026-10-03'));
    expect(g.map((d) => d.date)).toEqual(['2026-10-10', '2026-10-05', '2026-10-03']);
    expect(g[0]!.net).toBe(0);
    expect(g[2]!.net).toBe(-195090);
  });
});
