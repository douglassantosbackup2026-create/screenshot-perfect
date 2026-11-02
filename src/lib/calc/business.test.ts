import { describe, it, expect } from 'vitest';
import { ageBand, churn, delta, formatCount, formatDelta, formatRate, incomeBand, monthlyBand, rate } from './business';

describe('variação e taxas', () => {
  it('variação contra o período anterior', () => {
    expect(delta(125, 100)).toBeCloseTo(0.25);
    expect(delta(80, 100)).toBeCloseTo(-0.2);
    expect(delta(10, 0)).toBeNull();
    expect(delta(NaN, 10)).toBeNull();
  });

  it('taxa limitada entre 0 e 1, sem dividir por zero', () => {
    expect(rate(30, 120)).toBeCloseTo(0.25);
    expect(rate(5, 0)).toBeNull();
    expect(rate(200, 100)).toBe(1);
  });

  it('churn: cancelamentos sobre ativos no início', () => {
    expect(churn(3, 100)).toBeCloseTo(0.03);
    expect(churn(1, 0)).toBeNull();
  });

  it('formatação', () => {
    expect(formatDelta(0.124)).toBe('+12%');
    expect(formatDelta(-0.031)).toBe('−3%');
    expect(formatDelta(0.001)).toBe('0%');
    expect(formatDelta(null)).toBe('—');
    expect(formatRate(0.416)).toBe('42%');
    expect(formatRate(null)).toBe('—');
  });

  it('contagem pequena aparece como <5', () => {
    expect(formatCount(null)).toBe('<5');
    expect(formatCount(1234)).toBe('1.234');
  });
});

describe('faixas da calculadora', () => {
  it('idade, renda e aporte viram faixas', () => {
    expect(ageBand(22)).toBe('até 29');
    expect(ageBand(30)).toBe('30–39');
    expect(ageBand(64)).toBe('60+');
    expect(incomeBand(2999)).toBe('até R$ 3 mil');
    expect(incomeBand(8000)).toBe('R$ 6–10 mil');
    expect(incomeBand(50000)).toBe('acima de R$ 20 mil');
    expect(monthlyBand(2660)).toBe('R$ 1,5–3 mil');
  });
});
