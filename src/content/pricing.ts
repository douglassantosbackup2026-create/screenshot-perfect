// Planos mostrados na landing e na tela de Assinatura. Não existe plano grátis: o Inteligência é a
// assinatura base e o Pro ainda é lista de espera. Valores iguais aos de src/lib/billing/catalog.ts.
import { JOURNEY_ENABLED } from "@/lib/features";

export type PlanTier = {
  slug: "inteligencia" | "pro";
  name: string;
  price: string;
  period: string;
  tag: string;
  highlight: boolean;
  /** Preço anual, quando existe, com o equivalente por mês. */
  annualNote?: string;
  /** Origem gravada em `leads.source` pela lista de espera; null para o plano que já está à venda. */
  waitlistSource: string | null;
  summary: string;
  features: string[];
};

export const PLANS: PlanTier[] = [
  {
    slug: "inteligencia",
    name: "Inteligência",
    price: "R$ 29,90",
    period: "/mês",
    tag: "Assinatura",
    highlight: true,
    annualNote: "ou R$ 239,90 por ano (cerca de R$ 20 por mês)",
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
    price: "R$ 59,90",
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
