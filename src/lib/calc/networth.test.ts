import { describe, it, expect } from 'vitest';
import {
  assetHistory,
  cumulativeReturn,
  fiMilestones,
  growthSummary,
  modifiedDietz,
  periodReturns,
  snapshotFromAssets,
  type SnapshotItem,
} from './networth';
import { wealthTimeline } from './progress';

const at = '2026-10-01T12:00:00.000Z';

describe('histórico por item', () => {
  it('fica com o último valor de cada mês, em ordem, com a variação', () => {
    const h = assetHistory(
      [
        { assetId: 'a', month: '2026-09-01', value: 2000 },
        { assetId: 'b', month: '2026-08-01', value: 99 },
        { assetId: 'a', month: '2026-07-01', value: 1000 },
        { assetId: 'a', month: '2026-09-01', value: 2500 },
      ],
      'a',
    );
    expect(h).toEqual([
      { month: '2026-07-01', value: 1000, delta: null },
      { month: '2026-09-01', value: 2500, delta: 1500 },
    ]);
  });
});

describe('foto do mês a partir dos itens', () => {
  it('usa só o que é para a aposentadoria, como o plano', () => {
    const items: SnapshotItem[] = [
      { id: '1', name: 'PGBL', category: 'pgbl', value: 8000, forRetirement: true, updatedAt: at },
      { id: '2', name: 'Tesouro', category: 'investimentos', value: 2000, forRetirement: true, updatedAt: at },
      { id: '3', name: 'Reserva', category: 'reserva', value: 6000, forRetirement: false, updatedAt: at },
      { id: '4', name: 'INSS', category: 'beneficio', value: 3000, forRetirement: true, updatedAt: at },
      { id: '5', name: 'Cartão', category: 'divida', value: 500, forRetirement: true, updatedAt: at },
    ];
    const s = snapshotFromAssets(items);
    expect(s.total).toBe(10000);
    expect(s.previdencia).toBe(8000);
    expect(s.breakdown.map((b) => b.assetId)).toEqual(['1', '2']);
  });
});

describe('rendimento estimado', () => {
  it('Dietz modificado: aporte conta pela metade do período', () => {
    // 10.000 + aporte de 1.000 → 11.300: ganho de 300 sobre base de 10.500
    expect(modifiedDietz(10000, 11300, 1000)).toBeCloseTo(300 / 10500, 10);
    expect(modifiedDietz(0, 1000, 1000)).toBe(0);
    expect(modifiedDietz(0, 0, 0)).toBeNull();
  });

  it('separa aportes do resto e encadeia os períodos', () => {
    const tl = wealthTimeline(
      [
        { month: '2026-07-01', total: 10000 },
        { month: '2026-08-01', total: 11300 },
        { month: '2026-09-01', total: 11000 },
      ],
      [{ month: '2026-08-01', amount: 1000 }],
    );
    const rates = periodReturns(tl);
    expect(rates.map((r) => r.month)).toEqual(['2026-08-01', '2026-09-01']);
    expect(rates[1]!.rate).toBeCloseTo(-300 / 11300, 10);
    expect(cumulativeReturn(rates.map((r) => r.rate))).toBeCloseTo((1 + 300 / 10500) * (1 - 300 / 11300) - 1, 10);
    expect(growthSummary(tl)).toEqual({ fromMonth: '2026-07-01', toMonth: '2026-09-01', growth: 1000, contributions: 1000, other: 0 });
  });

  it('sem dados suficientes não inventa número', () => {
    expect(cumulativeReturn([null])).toBeNull();
    expect(growthSummary(wealthTimeline([{ month: '2026-07-01', total: 1 }]))).toBeNull();
  });
});

describe('marcos rumo à independência', () => {
  it('marca os alcançados e aponta o próximo', () => {
    const m = fiMilestones(0.5);
    expect(m.milestones.map((x) => x.reached)).toEqual([true, true, false, false]);
    expect(m.next).toBe(0.75);
    expect(fiMilestones(1).next).toBeNull();
  });
});
