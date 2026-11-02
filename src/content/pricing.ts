// Planos mostrados na landing e na tela de Assinatura. Não existe plano grátis: o Inteligência é a
// assinatura base e o Pro ainda é lista de espera. Os preços vêm do banco (plan_prices; ver src/lib/billing/prices.ts).
import { JOURNEY_ENABLED } from "@/lib/features";
import { annualPerMonthCents, formatMoney, formatReais } from "@/lib/calc/format";
import type { PlanPrices } from "@/lib/billing/catalog";

export type PlanTier = {
  slug: "inteligencia" | "pro";
  name: string;
  price: string;
  period: string;
  tag: string;
  highlight: boolean;
  /** Preço anual, quando existe, com o equivalente por mês. */
  annualNote?: string | undefined;
  /** Origem gravada em `leads.source` pela lista de espera; null para o plano que já está à venda. */
  waitlistSource: string | null;
  summary: string;
  features: string[];
};

/** Os planos com os preços de hoje. */
export const plansFor = (prices: PlanPrices): PlanTier[] => [
  {
    slug: "inteligencia",
    name: "Inteligência",
    price: formatMoney(prices.inteligencia.mensal ?? 0),
    period: "/mês",
    tag: "Assinatura",
    highlight: true,
    annualNote: prices.inteligencia.anual
      ? `ou ${formatMoney(prices.inteligencia.anual)} por ano (cerca de ${formatReais(annualPerMonthCents(prices.inteligencia.anual))} por mês)`
      : undefined,
    waitlistSource: null,
    summary: "Orçamento, patrimônio e aposentadoria num app só.",
    features: [
      "Lançamentos, contas, orçamento e fechamento do mês",
      "Patrimônio e progresso mês a mês",
      "Plano de aposentadoria em três cenários",
      "Projetado × real: seu plano está no ritmo?",
      "“E se…?” e a menor idade para parar de trabalhar",
      "Raio-X do patrimônio, projeção do fim do mês e alertas de cobrança estranha",
      "Limites de gasto ilimitados",
      ...(JOURNEY_ENABLED ? ["Jornada em 4 unidades, com missões, níveis e conquistas"] : []),
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    price: formatMoney(prices.pro.mensal ?? 0),
    period: "/mês",
    tag: "Em breve",
    highlight: false,
    waitlistSource: "waitlist_pro",
    summary: "Para quem quer ir mais fundo no acompanhamento.",
    features: [
      "Tudo do Inteligência",
      "Análises mais avançadas",
      "Várias metas ao mesmo tempo",
      "Relatórios detalhados e acompanhamento ampliado",
    ],
  },
];

export const PRICING_NOTE =
  "Cobrança mensal ou anual no cartão de crédito, pelo Mercado Pago. Cancele quando quiser; o acesso vai até o fim do período pago.";
