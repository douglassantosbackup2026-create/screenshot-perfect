import { describe, it, expect } from 'vitest';
import { parseEntry } from './quickEntry';

const today = '2026-10-27';
const p = (t: string) => parseEntry(t, today);

describe('parseEntry: frases como chegam', () => {
  it.each([
    ['gastei 62 na farmácia', { amount: 6200, kind: 'saida', payee: 'Farmácia', categoryHint: 'cat-saude', date: today }],
    ['gastei 62 na farmácia agora', { amount: 6200, payee: 'Farmácia' }],
    ['Uber 23,90, débito.', { amount: 2390, payee: 'Uber', categoryHint: 'cat-transporte' }],
    ['Paguei 1.240,00 de aluguel hoje.', { amount: 124000, payee: 'Aluguel', categoryHint: 'cat-moradia', date: today }],
    ['recebi 800 do freela, anota aí 🙌', { amount: 80000, kind: 'entrada', payee: 'Freela', categoryHint: 'cat-renda' }],
    ['esqueci de anotar o almoço de ontem, 39 😅', { amount: 3900, payee: 'Almoço', date: '2026-10-26', categoryHint: 'cat-restaurantes' }],
    ['Almoço R$ 141,60 no cartão do Itaú.', { amount: 14160, payee: 'Almoço' }],
    ['paguei 180 de luz no pix', { amount: 18000, payee: 'Luz', categoryHint: 'cat-moradia' }],
    ['coloquei 250 de gasolina no fim de semana, esqueci de falar', { amount: 25000, payee: 'Gasolina', categoryHint: 'cat-transporte' }],
    ['mercado 420 anteontem', { amount: 42000, payee: 'Mercado', date: '2026-10-25' }],
    ['dentista 300 dia 12', { amount: 30000, payee: 'Dentista', date: '2026-10-12' }],
    ['academia 89,90 dia 30', { amount: 8990, payee: 'Academia', date: '2026-09-30' }],
  ])('%s', (text, expected) => {
    expect(p(text)).toMatchObject({ ...expected, missing: [] });
  });

  it('compra parcelada com o valor de cada parcela: "6x de 95"', () => {
    expect(p('Comprei uma cadeira em 6x de 95.')).toMatchObject({ amount: 57000, payee: 'Cadeira', installments: { count: 6, total: 57000 } });
  });
  it('compra parcelada com o total: "TV 1.500 em 10x"', () => {
    expect(p('comprei a TV 1.500 em 10x')).toMatchObject({ amount: 150000, payee: 'TV', installments: { count: 10, total: 150000 } });
  });
  it('sem valor, pergunta em vez de adivinhar', () => {
    expect(p('paguei a academia')).toMatchObject({ amount: null, payee: 'Academia', missing: ['valor'] });
  });
  it('só número: falta a descrição', () => {
    expect(p('62').missing).toEqual(['descricao']);
  });
  it('dia 31 num mês de 30 dias vira o último dia', () => {
    expect(parseEntry('conta 100 dia 31', '2026-11-05').date).toBe('2026-10-31');
  });
});
