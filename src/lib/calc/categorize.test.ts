import { describe, it, expect } from 'vitest';
import { applyRules, findRule, normalize, type CategoryRule } from './categorize';

const rules: CategoryRule[] = [
  { id: '1', op: 'contem', value: 'uber', categoryId: 'transporte', renameTo: 'Uber' },
  { id: '2', op: 'contem', value: 'uber eats', categoryId: 'restaurantes', renameTo: null },
  { id: '3', op: 'igual', value: 'PIX ENVIADO', categoryId: 'transferencias', renameTo: null },
  { id: '4', op: 'contem', value: 'pix', categoryId: 'outros', renameTo: null },
];

describe('regras de categoria', () => {
  it('compara sem acento, maiúsculas nem espaços extras', () => {
    expect(normalize('  Pão de  AÇÚCAR ')).toBe('pao de acucar');
  });

  it('a mais específica vence', () => {
    expect(findRule(rules, 'UBER *TRIP 1234')?.id).toBe('1');
    expect(findRule(rules, 'UBER EATS SAO PAULO')?.id).toBe('2');
    expect(findRule(rules, 'Pix enviado')?.id).toBe('3');
    expect(findRule(rules, 'PIX RECEBIDO')?.id).toBe('4');
    expect(findRule(rules, 'Padaria')).toBeNull();
  });

  it('aplica só em quem está sem categoria e pode renomear', () => {
    expect(applyRules(rules, { payee: 'UBER *TRIP', categoryId: null })).toEqual({ payee: 'Uber', categoryId: 'transporte' });
    expect(applyRules(rules, { payee: 'UBER *TRIP', categoryId: 'lazer' })).toEqual({ payee: 'UBER *TRIP', categoryId: 'lazer' });
  });
});
