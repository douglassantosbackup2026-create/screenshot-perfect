// O que fazer com cada notificação do Mercado Pago, já com os dados lidos da API (nunca do corpo da notificação).
// Funções puras: a rota /api/public/mercadopago/webhook busca os dados e executa a decisão.
import { parseReference, priceCents, toCents, type BillingPeriod, type PaidPlan } from "./catalog";

/** Pagamento (avulso ou cobrança de assinatura), como vem de GET /v1/payments/{id}. */
export type MpPayment = {
  id: number;
  status: string;
  transaction_amount: number;
  currency_id: string;
  external_reference?: string | null;
};

/** Cobrança de assinatura, como vem de GET /authorized_payments/{id}. */
export type MpAuthorizedPayment = {
  id: number;
  preapproval_id: string;
  transaction_amount: number;
  currency_id: string;
  external_reference?: string | null;
  payment?: { id: number; status: string } | null;
};

/** Assinatura, como vem de GET /preapproval/{id}. */
export type MpPreapproval = { id: string; status: string; external_reference?: string | null };

export type Credit = { id: string; userId: string; plan: PaidPlan; period: BillingPeriod; cents: number };
export type Decision =
  | { action: "credit"; credit: Credit }
  | { action: "subscription"; userId: string; preapprovalId: string; plan: PaidPlan; period: BillingPeriod; status: string }
  | { action: "ignore"; reason: string };

/** Credita só pagamento aprovado, em reais, com referência válida e o valor exato do catálogo. */
export function decidePayment(p: MpPayment): Decision {
  if (p.status !== "approved") return { action: "ignore", reason: "não aprovado" };
  const ref = parseReference(p.external_reference);
  const cents = toCents(p.transaction_amount);
  if (!ref || p.currency_id !== "BRL" || cents !== priceCents(ref.plan, ref.period))
    return { action: "ignore", reason: "referência ou valor não confere" };
  // Mesmo id para a notificação de pagamento e a de cobrança da assinatura: o banco credita uma vez só.
  return { action: "credit", credit: { id: `mp_${p.id}`, userId: ref.userId, plan: ref.plan, period: ref.period, cents } };
}

/**
 * Cobrança mensal ou anual da assinatura. A referência pode faltar na cobrança;
 * aí vale a da assinatura (`fallbackRef`, lida de GET /preapproval).
 */
export function decideAuthorizedPayment(ap: MpAuthorizedPayment, fallbackRef?: string | null): Decision {
  if (!ap.payment) return { action: "ignore", reason: "cobrança ainda sem pagamento" };
  return decidePayment({
    id: ap.payment.id,
    status: ap.payment.status,
    transaction_amount: ap.transaction_amount,
    currency_id: ap.currency_id,
    external_reference: ap.external_reference || fallbackRef || null,
  });
}

/** Mudança na assinatura (autorizada, pausada, cancelada): só registra o status; o acesso segue a validade paga. */
export function decidePreapproval(pre: MpPreapproval): Decision {
  const ref = parseReference(pre.external_reference);
  if (!ref) return { action: "ignore", reason: "referência inválida" };
  return { action: "subscription", userId: ref.userId, preapprovalId: pre.id, plan: ref.plan, period: ref.period, status: pre.status };
}
