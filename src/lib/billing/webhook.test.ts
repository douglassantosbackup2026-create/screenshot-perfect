import { describe, expect, it } from "vitest";
import { buildReference } from "./catalog";
import { decideAuthorizedPayment, decidePayment, decidePreapproval, isMercadoPagoUrl, MpPaymentSchema, MpPreapprovalSchema } from "./webhook";

const USER = "11111111-2222-3333-4444-555555555555";
const REF = buildReference(USER, "inteligencia", "mensal", 3990, 3990);

describe("pagamento", () => {
  it("aprovado, em reais e no valor do catálogo: credita", () => {
    expect(decidePayment({ id: 9, status: "approved", transaction_amount: 39.9, currency_id: "BRL", external_reference: REF })).toEqual({
      action: "credit",
      credit: { id: "mp_9", userId: USER, plan: "inteligencia", period: "mensal", cents: 3990 },
    });
  });
  it("valor diferente, outra moeda ou pendente: não credita", () => {
    expect(decidePayment({ id: 9, status: "approved", transaction_amount: 1, currency_id: "BRL", external_reference: REF }).action).toBe("ignore");
    expect(decidePayment({ id: 9, status: "approved", transaction_amount: 39.9, currency_id: "USD", external_reference: REF }).action).toBe("ignore");
    expect(decidePayment({ id: 9, status: "pending", transaction_amount: 39.9, currency_id: "BRL", external_reference: REF }).action).toBe("ignore");
  });
  it("com cupom: aceita o valor com desconto e o cheio (depois do prazo); outro valor, não", () => {
    const ref = buildReference(USER, "inteligencia", "mensal", 3192, 3990);
    const pay = (amount: number) => decidePayment({ id: 9, status: "approved", transaction_amount: amount, currency_id: "BRL", external_reference: ref });
    expect(pay(31.92)).toMatchObject({ action: "credit", credit: { cents: 3192 } });
    expect(pay(39.9)).toMatchObject({ action: "credit", credit: { cents: 3990 } });
    expect(pay(20).action).toBe("ignore");
  });
  it("preço mudou: vale o preço do dia em que a pessoa assinou, não o de hoje", () => {
    const pay = (amount: number, reference: string) =>
      decidePayment({ id: 9, status: "approved", transaction_amount: amount, currency_id: "BRL", external_reference: reference });
    // Assinou a R$ 44,90 depois do aumento.
    expect(pay(44.9, buildReference(USER, "inteligencia", "mensal", 4490, 4490)).action).toBe("credit");
    expect(pay(39.9, buildReference(USER, "inteligencia", "mensal", 4490, 4490)).action).toBe("ignore");
    // Assinatura antiga, de antes de o preço ir para o banco, continua a R$ 39,90.
    expect(pay(39.9, `${USER}|inteligencia|mensal`).action).toBe("credit");
    expect(pay(44.9, `${USER}|inteligencia|mensal`).action).toBe("ignore");
  });
});

describe("cobrança da assinatura", () => {
  const ap = { id: 1, preapproval_id: "pre_1", transaction_amount: 39.9, currency_id: "BRL", payment: { id: 77, status: "approved" } };
  it("usa o id do pagamento: a mesma cobrança notificada duas vezes credita uma vez só", () => {
    const viaSubscription = decideAuthorizedPayment({ ...ap, external_reference: REF });
    const viaPayment = decidePayment({ id: 77, status: "approved", transaction_amount: 39.9, currency_id: "BRL", external_reference: REF });
    expect(viaSubscription).toEqual(viaPayment);
  });
  it("sem referência na cobrança, usa a da assinatura", () => {
    const d = decideAuthorizedPayment({ ...ap, external_reference: null }, REF);
    expect(d).toMatchObject({ action: "credit", credit: { userId: USER } });
  });
  it("cobrança recusada ou ainda sem pagamento: não credita", () => {
    expect(decideAuthorizedPayment({ ...ap, external_reference: REF, payment: { id: 77, status: "rejected" } }).action).toBe("ignore");
    expect(decideAuthorizedPayment({ ...ap, external_reference: REF, payment: null }).action).toBe("ignore");
  });
});

describe("assinatura", () => {
  it("cancelada: só registra o status", () => {
    expect(decidePreapproval({ id: "pre_1", status: "cancelled", external_reference: REF })).toEqual({
      action: "subscription",
      userId: USER,
      preapprovalId: "pre_1",
      plan: "inteligencia",
      period: "mensal",
      status: "cancelled",
      eventAt: null,
    });
  });
  it("leva a hora da última mudança, para gravar em ordem", () => {
    const d = decidePreapproval({ id: "pre_1", status: "paused", external_reference: REF, last_modified: "2026-10-30T10:00:00.000-04:00" });
    expect(d.action === "subscription" && d.eventAt).toBe("2026-10-30T14:00:00.000Z");
    const bad = decidePreapproval({ id: "pre_1", status: "paused", external_reference: REF, last_modified: "ontem" });
    expect(bad.action === "subscription" && bad.eventAt).toBeNull();
  });
  it("referência inválida: ignora", () => {
    expect(decidePreapproval({ id: "pre_1", status: "authorized", external_reference: "x" }).action).toBe("ignore");
  });
});

describe("respostas do Mercado Pago", () => {
  it("assinatura com status desconhecido ou link fora do Mercado Pago é recusada", () => {
    const base = { id: "pre_1", status: "authorized", external_reference: REF };
    expect(MpPreapprovalSchema.safeParse(base).success).toBe(true);
    expect(MpPreapprovalSchema.safeParse({ ...base, status: "aprovadissima" }).success).toBe(false);
    expect(MpPreapprovalSchema.safeParse({ ...base, init_point: "https://www.mercadopago.com.br/subscriptions/checkout?x=1" }).success).toBe(true);
    expect(MpPreapprovalSchema.safeParse({ ...base, init_point: "https://mercadopago.com.evil.io/x" }).success).toBe(false);
    expect(MpPreapprovalSchema.safeParse({ ...base, init_point: "http://www.mercadopago.com.br/x" }).success).toBe(false);
  });
  it("pagamento sem valor numérico é recusado", () => {
    expect(MpPaymentSchema.safeParse({ id: 1, status: "approved", transaction_amount: "39.9", currency_id: "BRL" }).success).toBe(false);
  });
  it("só mercadopago.com e mercadopago.com.br", () => {
    expect(isMercadoPagoUrl("https://sandbox.mercadopago.com.br/x")).toBe(true);
    expect(isMercadoPagoUrl("https://notmercadopago.com/x")).toBe(false);
    expect(isMercadoPagoUrl("javascript:alert(1)")).toBe(false);
  });
});
