import { describe, it, expect } from 'vitest';
import { aboveAverage, budgetAlertCrossed, budgetAlertLevel, budgetAlerts, duplicateCharges, priceChanges, type AnomalyTx } from './alerts';
import { RETIREMENT_ENVELOPE } from './budget';

const env = (assigned: number, activity: number, carry = 0) => ({ carry, assigned, activity, balance: carry + assigned + activity });

describe('budgetAlertLevel', () => {
  it('avisa a partir de 75% e marca o limite em 100%', () => {
    expect(budgetAlertLevel(80000, 59200)).toBeNull(); // 74%
    expect(budgetAlertLevel(80000, 60000)).toBe('atencao'); // 75%
    expect(budgetAlertLevel(80000, 80000)).toBe('limite'); // 100%
    expect(budgetAlertLevel(80000, 95000)).toBe('limite');
  });
  it('sem dinheiro no envelope ou sem gasto, não avisa', () => {
    expect(budgetAlertLevel(0, 5000)).toBeNull();
    expect(budgetAlertLevel(80000, 0)).toBeNull();
  });
});

describe('budgetAlerts', () => {
  it('conta o saldo que veio do mês anterior e ignora o envelope Aposentadoria', () => {
    const r = budgetAlerts({
      'cat-mercado': env(60000, -64000, 20000), // 80% de 800
      'cat-lazer': env(10000, -2000),
      [RETIREMENT_ENVELOPE]: env(50000, -50000),
    });
    expect(r).toEqual([{ envelopeId: 'cat-mercado', level: 'atencao', pct: 0.8, spent: 64000, available: 80000 }]);
  });
});

describe('budgetAlertCrossed', () => {
  it('só devolve quando o nível sobe', () => {
    expect(budgetAlertCrossed(null, 'atencao')).toBe('atencao');
    expect(budgetAlertCrossed('atencao', 'limite')).toBe('limite');
    expect(budgetAlertCrossed('atencao', 'atencao')).toBeNull();
    expect(budgetAlertCrossed('limite', 'atencao')).toBeNull();
  });
});

let seq = 0;
const tx = (date: string, amount: number, payee: string, extra: Partial<AnomalyTx> = {}): AnomalyTx => ({
  id: `t${++seq}`, accountId: 'a1', date, amount, payee, categoryId: null, transferId: null, scheduled: false, ...extra,
});

describe('duplicateCharges', () => {
  it('mesma descrição, valor e conta em até 3 dias vira aviso', () => {
    const a = tx('2026-10-10', -8990, 'Farmácia São João');
    const b = tx('2026-10-11', -8990, 'farmacia sao joao');
    const r = duplicateCharges([a, b], '2026-10-01');
    expect(r).toHaveLength(1);
    expect(r[0]!.ids).toEqual([a.id, b.id]);
    expect(r[0]!.amount).toBe(8990);
  });
  it('não avisa para parcelas, recorrências, valores diferentes ou dias distantes', () => {
    expect(duplicateCharges([tx('2026-10-10', -5000, 'TV', { scheduled: true }), tx('2026-10-10', -5000, 'TV', { scheduled: true })], '2026-10-01')).toEqual([]);
    expect(duplicateCharges([tx('2026-10-10', -5000, 'Uber'), tx('2026-10-10', -5100, 'Uber')], '2026-10-01')).toEqual([]);
    expect(duplicateCharges([tx('2026-10-01', -5000, 'Uber'), tx('2026-10-08', -5000, 'Uber')], '2026-10-01')).toEqual([]);
    expect(duplicateCharges([tx('2026-10-10', -5000, 'Uber'), tx('2026-10-10', -5000, 'Uber', { accountId: 'a2' })], '2026-10-01')).toEqual([]);
  });
  it('três iguais seguidos dão um aviso só', () => {
    const r = duplicateCharges([tx('2026-10-10', -100, 'Café'), tx('2026-10-10', -100, 'Café'), tx('2026-10-11', -100, 'Café')], '2026-10-01');
    expect(r).toHaveLength(1);
  });
});

describe('priceChanges', () => {
  it('assinatura que subiu de 39,90 para 55,90 vira aviso', () => {
    const r = priceChanges(
      [tx('2026-07-05', -3990, 'Streaming'), tx('2026-08-05', -3990, 'Streaming'), tx('2026-09-05', -3990, 'Streaming'), tx('2026-10-05', -5590, 'Streaming')],
      '2026-10-01',
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: 'preco', before: 3990, after: 5590 });
  });
  it('variação pequena, meses com buraco ou mais de uma cobrança por mês não avisam', () => {
    expect(priceChanges([tx('2026-08-05', -10000, 'Luz'), tx('2026-09-05', -10000, 'Luz'), tx('2026-10-05', -10100, 'Luz')], '2026-10-01')).toEqual([]);
    expect(priceChanges([tx('2026-06-05', -3990, 'X'), tx('2026-08-05', -3990, 'X'), tx('2026-10-05', -5590, 'X')], '2026-10-01')).toEqual([]);
    expect(
      priceChanges([tx('2026-08-05', -3990, 'Ifood'), tx('2026-09-05', -3990, 'Ifood'), tx('2026-10-05', -5590, 'Ifood'), tx('2026-10-06', -2000, 'Ifood')], '2026-10-01'),
    ).toEqual([]);
  });
  it('não avisa de novo uma mudança antiga', () => {
    expect(priceChanges([tx('2026-07-05', -3990, 'S'), tx('2026-08-05', -3990, 'S'), tx('2026-09-05', -5590, 'S')], '2026-10-01')).toEqual([]);
  });
});

describe('aboveAverage', () => {
  const months = (group: string, values: [string, number][]) => values.map(([date, v]) => ({ group, date, amount: -v }));
  it('fatura 18% acima da média de 3 meses vira aviso', () => {
    const items = months('cartao', [['2026-07-10', 100000], ['2026-08-10', 100000], ['2026-09-10', 100000], ['2026-10-10', 118000]]);
    const r = aboveAverage(items, '2026-10-01');
    expect(r).toHaveLength(1);
    expect(r[0]!.average).toBe(100000);
    expect(r[0]!.pct).toBeCloseTo(0.18);
  });
  it('abaixo do limite, diferença pequena em reais ou sem histórico completo, não avisa', () => {
    expect(aboveAverage(months('c', [['2026-07-10', 100000], ['2026-08-10', 100000], ['2026-09-10', 100000], ['2026-10-10', 110000]]), '2026-10-01')).toEqual([]);
    expect(aboveAverage(months('c', [['2026-07-10', 1000], ['2026-08-10', 1000], ['2026-09-10', 1000], ['2026-10-10', 3000]]), '2026-10-01')).toEqual([]);
    expect(aboveAverage(months('c', [['2026-08-10', 100000], ['2026-09-10', 100000], ['2026-10-10', 200000]]), '2026-10-01')).toEqual([]);
  });
});
