import { describe, it, expect } from 'vitest';
import { wealthXray, type XrayItem } from './xray';

const now = new Date('2026-10-27T12:00:00Z');
const fresh = '2026-10-01T12:00:00Z';
const item = (id: string, category: XrayItem['category'], value: number, extra: Partial<XrayItem> = {}): XrayItem => ({
  id, name: id, category, value, updatedAt: fresh, ...extra,
});

describe('wealthXray', () => {
  it('tudo num item: HHI 1; dois iguais: 0,5', () => {
    expect(wealthXray([item('a', 'pgbl', 1000)], null, now).hhi).toBe(1);
    expect(wealthXray([item('a', 'pgbl', 500), item('b', 'reserva', 500)], null, now).hhi).toBe(0.5);
  });
  it('liquidez: reserva e investimentos contam; previdência e imóvel, não', () => {
    const x = wealthXray([item('a', 'reserva', 100), item('b', 'investimentos', 100), item('c', 'pgbl', 100), item('d', 'imovel', 100)], null, now);
    expect(x.liquidShare).toBe(0.5);
  });
  it('benefício não entra nas contas; sem ativos, nada a medir', () => {
    const x = wealthXray([item('inss', 'beneficio', 3000)], null, now);
    expect(x).toMatchObject({ assetsTotal: 0, hhi: null, largest: null, liquidShare: null, issues: [] });
  });
  it('concentrado: o maior item passa de 60%', () => {
    const x = wealthXray([item('imovel', 'imovel', 700), item('r', 'reserva', 300)], 1, now);
    expect(x.issues.map((i) => i.code)).toEqual(['concentrado']);
    expect(x.issues[0]!.ids).toEqual(['imovel']);
  });
  it('dívidas acima de 50% dos ativos, sem juros informados, e reserva incompleta', () => {
    const x = wealthXray([item('p', 'pgbl', 1000), item('cartao', 'divida', 600)], 0.4, now);
    expect(x.issues.map((i) => i.code)).toEqual(['endividado', 'sem_reserva', 'divida_sem_juros']);
    expect(x.actions).toHaveLength(3);
  });
  it('item sem atualização há mais de 90 dias', () => {
    const x = wealthXray([item('velho', 'pgbl', 100, { updatedAt: '2026-06-01T12:00:00Z' }), item('novo', 'reserva', 100)], null, now);
    expect(x.issues).toEqual([{ code: 'desatualizado', severity: 1, ids: ['velho'], value: 1 }]);
  });
  it('dívida com juros informados não pede os juros', () => {
    const x = wealthXray([item('p', 'pgbl', 10000), item('fin', 'divida', 1000, { rateMonthly: 0.01 })], null, now);
    expect(x.issues).toEqual([]);
  });
});
