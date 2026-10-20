import { describe, it, expect } from 'vitest';
import { summarizeAssets, validateAsset, type AssetItem } from './assets';

const at = (d: string) => `${d}T12:00:00.000Z`;

describe('patrimônio item a item', () => {
  it('lista vazia', () => {
    expect(summarizeAssets([])).toEqual({
      retirementTotal: 0, otherTotal: 0, debtsTotal: 0, incomeSourcesMonthly: 0, byCategory: {}, oldestUpdate: null,
    });
  });

  it('separa aposentadoria, outros ativos, dívidas e rendas', () => {
    const items: AssetItem[] = [
      { category: 'pgbl', value: 8000, forRetirement: true, updatedAt: at('2026-10-01') },
      { category: 'investimentos', value: 2000, forRetirement: true, updatedAt: at('2026-09-01') },
      { category: 'reserva', value: 15000, forRetirement: false, updatedAt: at('2026-10-10') },
      { category: 'divida', value: 3000, forRetirement: true, updatedAt: at('2026-10-10') },
      { category: 'beneficio', value: 1500, forRetirement: true, updatedAt: at('2026-10-10') },
    ];
    const s = summarizeAssets(items);
    expect(s.retirementTotal).toBe(10000);
    expect(s.otherTotal).toBe(15000);
    expect(s.debtsTotal).toBe(3000);
    expect(s.incomeSourcesMonthly).toBe(1500);
    expect(s.byCategory.pgbl).toBe(8000);
    expect(s.oldestUpdate).toBe(at('2026-09-01'));
  });

  it('rejeita valores inválidos', () => {
    expect(validateAsset({ name: 'PGBL', value: -1 })).toHaveLength(1);
    expect(validateAsset({ name: 'PGBL', value: Number.NaN })).toHaveLength(1);
    expect(validateAsset({ name: ' ', value: 10 })).toHaveLength(1);
    expect(validateAsset({ name: 'PGBL', value: 0 })).toHaveLength(0);
  });
});
