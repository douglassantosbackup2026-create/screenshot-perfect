// Cupom de desconto na assinatura. Funções puras: o servidor calcula o valor cobrado no Mercado Pago com
// discountedCents, e o webhook decide com shouldRevert quando a assinatura volta ao preço cheio.

export type CouponKind = "percent" | "fixed";
export type CouponDuration = "primeira" | "meses" | "sempre";

export type CouponTerms = {
  kind: CouponKind;
  value: number;          // percent: basis points (2000 = 20%); fixed: centavos
  duration: CouponDuration;
  cycles: number | null;  // só em "meses": quantas cobranças com desconto
};

/** Menor cobrança que o Mercado Pago aceita numa assinatura (centavos). */
export const MIN_CHARGE_CENTS = 100;

export const DURATION_LABEL: Record<CouponDuration, string> = {
  primeira: "Só a 1ª cobrança",
  meses: "As primeiras cobranças",
  sempre: "Enquanto assinar",
};

/** Preço com o desconto, em centavos; nunca abaixo do mínimo do Mercado Pago (nem acima do preço). */
export function discountedCents(priceCents: number, terms: Pick<CouponTerms, "kind" | "value">): number {
  const price = Math.max(Math.round(priceCents), 0);
  const off =
    terms.kind === "percent"
      ? Math.round((price * Math.min(Math.max(terms.value, 0), 10000)) / 10000)
      : Math.max(Math.round(terms.value), 0);
  return Math.min(Math.max(price - off, MIN_CHARGE_CENTS), price);
}

/** Quantas cobranças têm desconto; null = todas. */
export function couponCycles(terms: Pick<CouponTerms, "duration" | "cycles">): number | null {
  if (terms.duration === "primeira") return 1;
  if (terms.duration === "meses") return Math.max(terms.cycles ?? 1, 1);
  return null;
}

/** Acabou o prazo do desconto e a assinatura ainda cobra o valor com desconto. */
export function shouldRevert(sub: { amountCents: number; fullCents: number; cycles: number | null; cyclesUsed: number }): boolean {
  return sub.cycles !== null && sub.cyclesUsed >= sub.cycles && sub.amountCents < sub.fullCents;
}

/** Valor digitado em reais ("10", "9,90", "1.000,50") em centavos; null se não for positivo. */
export function parseCents(text: string): number | null {
  const v = Number(text.replace(/\./g, "").replace(",", ".").trim());
  return text.trim() && Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
}

/** "20% de desconto nas 3 primeiras cobranças", "R$ 10,00 de desconto na 1ª cobrança"… */
export function describeCoupon(terms: CouponTerms): string {
  const off =
    terms.kind === "percent"
      ? `${(terms.value / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`
      : (terms.value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const n = couponCycles(terms);
  const when = n === null ? "enquanto assinar" : n === 1 ? "na 1ª cobrança" : `nas ${n} primeiras cobranças`;
  return `${off} de desconto ${when}`;
}
