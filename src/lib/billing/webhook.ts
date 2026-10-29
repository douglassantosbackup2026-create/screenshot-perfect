// O que fazer com cada notificação do Mercado Pago, já com os dados lidos da API (nunca do corpo da notificação).
// Funções puras: a rota /api/public/mercadopago/webhook busca os dados e executa a decisão.
import { z } from "zod";
import { parseReference, priceCents, toCents, type BillingPeriod, type PaidPlan } from "./catalog";

const money = z.number().finite().nonnegative();

/** https em mercadopago.com ou mercadopago.com.br (ou subdomínio). */
export function isMercadoPagoUrl(u: string): boolean {
  try {
    const { protocol, hostname } = new URL(u);
    return protocol === "https:" && /(^|\.)mercadopago\.com(\.br)?$/.test(hostname);
  } catch {
    return false;
  }
}
const reference = z.string().max(200).nullish();

/** Pagamento (avulso ou cobrança de assinatura), como vem de GET /v1/payments/{id}. */
export const MpPaymentSchema = z.object({
  id: z.number().int(),
  status: z.string(),
  transaction_amount: money,
  currency_id: z.string(),
  external_reference: reference,
});
export type MpPayment = z.infer<typeof MpPaymentSchema>;

/** Cobrança de assinatura, como vem de GET /authorized_payments/{id}. */
export const MpAuthorizedPaymentSchema = z.object({
  id: z.number().int(),
  preapproval_id: z.string().min(1).max(64),
  transaction_amount: money,
  currency_id: z.string(),
  external_reference: reference,
  payment: z.object({ id: z.number().int(), status: z.string() }).nullish(),
});
export type MpAuthorizedPayment = z.infer<typeof MpAuthorizedPaymentSchema>;

/** Estados de uma assinatura no Mercado Pago (iguais ao check de subscriptions.status). */
export const SUBSCRIPTION_STATUSES = ["pending", "authorized", "paused", "cancelled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Assinatura, como vem de GET /preapproval/{id} (e na criação, com o link de autorização). */
export const MpPreapprovalSchema = z.object({
  id: z.string().min(1).max(64),
  status: z.enum(SUBSCRIPTION_STATUSES),
  external_reference: reference,
  // Só aceitamos mandar a pessoa para o próprio Mercado Pago.
  init_point: z
    .string()
    .url()
    .refine(isMercadoPagoUrl, "link fora do Mercado Pago")
    .optional(),
});
export type MpPreapproval = z.infer<typeof MpPreapprovalSchema>;

export type Credit = { id: string; userId: string; plan: PaidPlan; period: BillingPeriod; cents: number };
export type Decision =
  | { action: "credit"; credit: Credit }
  | { action: "subscription"; userId: string; preapprovalId: string; plan: PaidPlan; period: BillingPeriod; status: SubscriptionStatus }
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
