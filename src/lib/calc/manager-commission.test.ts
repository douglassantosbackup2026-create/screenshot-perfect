import { describe, it, expect } from 'vitest';
import { managerCommissionFor } from './commission';

const first = '2026-01-10T12:00:00Z';
describe('managerCommissionFor', () => {
  it('pagamento de R$ 100 com 5% dá R$ 5 ao gerente', () => {
    expect(managerCommissionFor({ mode: 'sempre', bp: 2000, months: null }, 500, { paymentCents: 10000, paidAt: first, firstPaidAt: first, previousCount: 0 })).toBe(500);
  });
  it('segue o prazo do parceiro: depois dos 12 meses, nada', () => {
    expect(managerCommissionFor({ mode: 'meses', bp: 2000, months: 12 }, 500, { paymentCents: 10000, paidAt: '2027-01-10T12:00:00Z', firstPaidAt: first, previousCount: 12 })).toBe(0);
    expect(managerCommissionFor({ mode: 'meses', bp: 2000, months: 12 }, 500, { paymentCents: 10000, paidAt: '2026-12-10T12:00:00Z', firstPaidAt: first, previousCount: 11 })).toBe(500);
  });
  it('só o 1º pagamento quando o parceiro é "primeiro"', () => {
    expect(managerCommissionFor({ mode: 'primeiro', bp: 2000, months: null }, 500, { paymentCents: 10000, paidAt: first, firstPaidAt: first, previousCount: 1 })).toBe(0);
  });
});
