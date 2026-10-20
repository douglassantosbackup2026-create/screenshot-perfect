import { describe, it, expect } from 'vitest';
import { allocateContribution, allocation, positionFromTrades, returnSummary, tradeFlows, validateTargets, valuePosition, xirr, type Trade } from './portfolio';

const tr = (date: string, type: Trade['type'], quantity: number, unitPrice: number, fees = 0): Trade => ({ id: date + type, date, type, quantity, unitPrice, fees });

describe('preço médio', () => {
  it('compra soma custo com taxas; venda realiza contra o preço médio', () => {
    const p = positionFromTrades([
      tr('2026-01-10', 'compra', 10, 10000, 500), // custo 100.500
      tr('2026-02-10', 'compra', 10, 12000),      // custo 120.000 → médio 11.025
      tr('2026-03-10', 'venda', 5, 13000, 300),   // 65.000 − 300 − 55.125
      tr('2026-03-15', 'provento', 0, 2500),
    ]);
    expect(p.quantity).toBe(15);
    expect(p.avgPrice).toBe(11025);
    expect(p.costBasis).toBe(165375);
    expect(p.realized).toBe(65000 - 300 - 55125);
    expect(p.income).toBe(2500);
    expect(p.invested).toBe(220500);
    expect(p.oversold).toBe(false);
  });

  it('no mesmo dia, compra antes da venda; vender tudo zera o custo', () => {
    const p = positionFromTrades([tr('2026-01-10', 'venda', 2, 15000), tr('2026-01-10', 'compra', 2, 10000)]);
    expect(p).toMatchObject({ quantity: 0, costBasis: 0, avgPrice: 0, realized: 10000, oversold: false });
  });

  it('venda acima da quantidade é marcada e não fica negativa', () => {
    const p = positionFromTrades([tr('2026-01-10', 'compra', 1, 10000), tr('2026-01-11', 'venda', 3, 10000)]);
    expect(p.oversold).toBe(true);
    expect(p.quantity).toBe(0);
  });

  it('frações de título e ganho não realizado', () => {
    const p = positionFromTrades([tr('2026-01-10', 'compra', 0.4, 240000), tr('2026-02-10', 'compra', 0.2, 245000)]);
    const v = valuePosition(p, 250000);
    expect(v.marketValue).toBe(150000);
    expect(v.costBasis).toBe(145000);
    expect(v.unrealized).toBe(5000);
    expect(v.unrealizedPct).toBeCloseTo(5000 / 145000, 10);
  });
});

describe('alocação e aporte', () => {
  it('fração por classe, incluindo classes só com meta', () => {
    const a = allocation([{ assetClass: 'previdencia', value: 800 }, { assetClass: 'acoes', value: 200 }], { previdencia: 60, acoes: 20, renda_fixa: 20 });
    expect(a.map((x) => [x.assetClass, x.share, x.target])).toEqual([
      ['previdencia', 0.8, 0.6],
      ['renda_fixa', 0, 0.2],
      ['acoes', 0.2, 0.2],
    ]);
  });

  it('metas precisam somar 100%', () => {
    expect(validateTargets({ previdencia: 60, acoes: 40 })).toEqual([]);
    expect(validateTargets({ previdencia: 60, acoes: 30 })).toHaveLength(1);
    expect(validateTargets({ previdencia: 120, acoes: -20 })).toHaveLength(1);
  });

  it('só compra, enchendo pelo fundo quem está mais abaixo da meta', () => {
    // Total 1.000.000 + aporte 100.000; metas 60/25/15
    const s = allocateContribution({ previdencia: 800000, renda_fixa: 150000, acoes: 50000 }, { previdencia: 60, renda_fixa: 25, acoes: 15 }, 100000);
    expect(s.map((x) => [x.assetClass, x.amount])).toEqual([
      ['renda_fixa', 55000],
      ['acoes', 45000],
    ]);
    expect(s.reduce((a, x) => a + x.amount, 0)).toBe(100000);
  });

  it('aporte grande o bastante leva todas exatamente à meta', () => {
    const s = allocateContribution({ previdencia: 100, acoes: 0 }, { previdencia: 50, acoes: 50 }, 300);
    expect(s.map((x) => [x.assetClass, x.amount])).toEqual([
      ['acoes', 200],
      ['previdencia', 100],
    ]);
    expect(s.every((x) => Math.abs(x.after - x.target) < 1e-9)).toBe(true);
  });

  it('centavos que sobram do arredondamento vão para quem está mais abaixo', () => {
    const s = allocateContribution({}, { previdencia: 33.34, acoes: 33.33, renda_fixa: 33.33 }, 100);
    expect(s.reduce((a, x) => a + x.amount, 0)).toBe(100);
  });
});

describe('XIRR', () => {
  it('10% ao ano em um ano exato', () => {
    expect(xirr([{ date: '2025-01-01', amount: -1000 }, { date: '2026-01-01', amount: 1100 }])).toBeCloseTo(0.1, 6);
  });

  it('fluxos intermediários', () => {
    const r = xirr([
      { date: '2025-01-01', amount: -1000 },
      { date: '2025-07-01', amount: -1000 },
      { date: '2026-01-01', amount: 2200 },
    ])!;
    const t = (d: string) => (Date.parse(d) - Date.parse('2025-01-01')) / (365 * 86400000);
    expect(-1000 - 1000 / Math.pow(1 + r, t('2025-07-01')) + 2200 / Math.pow(1 + r, t('2026-01-01'))).toBeCloseTo(0, 6);
  });

  it('sem saída e entrada, ou com menos de 30 dias, não calcula', () => {
    expect(xirr([{ date: '2025-01-01', amount: 1000 }, { date: '2026-01-01', amount: 1100 }])).toBeNull();
    expect(xirr([{ date: '2025-01-01', amount: -1000 }, { date: '2025-01-20', amount: 1100 }])).toBeNull();
  });

  it('com menos de um ano, mostra o acumulado no período; com um ano ou mais, ao ano', () => {
    const short = returnSummary([{ date: '2025-01-01', amount: -1000 }, { date: '2025-03-02', amount: 1040 }])!;
    expect(short.annual).toBe(false);
    expect(short.rate).toBeCloseTo(0.04, 6);
    const long = returnSummary([{ date: '2024-01-01', amount: -1000 }, { date: '2026-01-01', amount: 1210 }])!;
    expect(long.annual).toBe(true);
    expect(long.rate).toBeCloseTo(0.1, 2);
  });

  it('fluxos de operações fecham com o valor de hoje', () => {
    const f = tradeFlows([tr('2025-01-01', 'compra', 1, 1000, 10), tr('2025-06-01', 'provento', 0, 50)], 1100, '2026-01-01');
    expect(f).toEqual([
      { date: '2025-01-01', amount: -1010 },
      { date: '2025-06-01', amount: 50 },
      { date: '2026-01-01', amount: 1100 },
    ]);
  });
});
