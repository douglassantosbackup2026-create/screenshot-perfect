import { describe, it, expect } from 'vitest';
import { couponCycles, describeCoupon, discountedCents, MIN_CHARGE_CENTS, parseCents, shouldRevert } from './coupon';

describe('discountedCents', () => {
  it('percentual, arredondado ao centavo', () => {
    expect(discountedCents(3990, { kind: 'percent', value: 2000 })).toBe(3192);
    expect(discountedCents(3990, { kind: 'percent', value: 1250 })).toBe(3491);
  });

  it('valor fixo', () => {
    expect(discountedCents(3990, { kind: 'fixed', value: 1000 })).toBe(2990);
  });

  it('nunca abaixo do mínimo do Mercado Pago nem acima do preço', () => {
    expect(discountedCents(3990, { kind: 'percent', value: 10000 })).toBe(MIN_CHARGE_CENTS);
    expect(discountedCents(3990, { kind: 'fixed', value: 999999 })).toBe(MIN_CHARGE_CENTS);
    expect(discountedCents(3990, { kind: 'fixed', value: -500 })).toBe(3990);
    expect(discountedCents(3990, { kind: 'percent', value: 0 })).toBe(3990);
  });
});

describe('couponCycles', () => {
  it('primeira = 1, meses = N, sempre = todas', () => {
    expect(couponCycles({ duration: 'primeira', cycles: null })).toBe(1);
    expect(couponCycles({ duration: 'meses', cycles: 3 })).toBe(3);
    expect(couponCycles({ duration: 'sempre', cycles: null })).toBeNull();
  });
});

describe('shouldRevert', () => {
  it('volta ao preço cheio só depois do prazo e se ainda está com desconto', () => {
    expect(shouldRevert({ amountCents: 3192, fullCents: 3990, cycles: 3, cyclesUsed: 2 })).toBe(false);
    expect(shouldRevert({ amountCents: 3192, fullCents: 3990, cycles: 3, cyclesUsed: 3 })).toBe(true);
    expect(shouldRevert({ amountCents: 3990, fullCents: 3990, cycles: 3, cyclesUsed: 5 })).toBe(false);
    expect(shouldRevert({ amountCents: 3192, fullCents: 3990, cycles: null, cyclesUsed: 50 })).toBe(false);
  });
});

describe('parseCents', () => {
  it('reais digitados em centavos', () => {
    expect(parseCents('10')).toBe(1000);
    expect(parseCents('9,90')).toBe(990);
    expect(parseCents('1.000,50')).toBe(100050);
    expect(parseCents('0')).toBeNull();
    expect(parseCents('abc')).toBeNull();
  });
});

describe('describeCoupon', () => {
  it('texto para a tela', () => {
    expect(describeCoupon({ kind: 'percent', value: 2000, duration: 'meses', cycles: 3 })).toBe('20% de desconto nas 3 primeiras cobranças');
    expect(describeCoupon({ kind: 'percent', value: 1000, duration: 'sempre', cycles: null })).toBe('10% de desconto enquanto assinar');
    expect(describeCoupon({ kind: 'fixed', value: 1000, duration: 'primeira', cycles: null })).toMatch(/^R\$\s10,00 de desconto na 1ª cobrança$/);
  });
});
