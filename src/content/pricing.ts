// Preços apenas para exibição (spec §15). Sem cobrança até o Gate 2.
// Os valores são hipóteses iniciais para testar, não preços validados por pesquisa.
import { JOURNEY_ENABLED } from "@/lib/features";

export type PlanTier = {
  slug: "free" | "inteligencia" | "pro";
  name: string;
  price: string;
  period: string | null;
  tag: string;
  highlight: boolean;
  /** Preço anual, quando existe, com o equivalente por mês (mesmos valores de src/lib/billing/catalog.ts). */
  annualNote?: string;
  /** Origem gravada em `leads.source` pela lista de espera; null para o plano gratuito. */
  waitlistSource: string | null;
  summary: string;
  features: string[];
};

export const PLANS: PlanTier[] = [
  {
    slug: "free",
    name: "Gratuito",
    price: "R$ 0",
    period: null,
    tag: "Para começar",
    highlight: false,
    waitlistSource: null,
    summary: JOURNEY_ENABLED
      ? "Crie o hábito de cuidar do seu futuro, alguns minutos por dia."
      : "Orçamento, patrimônio e aposentadoria num app só, de graça.",
    features: JOURNEY_ENABLED
      ? [
          "Jornada em 4 unidades, missão do dia e da semana",
          "XP, níveis e conquistas",
          "Sequência de dias e de semanas, sem punição por perder um dia",
          "Uma simulação de aposentadoria",
        ]
      : [
          "Plano de aposentadoria em três cenários",
          "Lançamentos, orçamento e fechamento do mês",
          "Patrimônio e progresso mês a mês",
          "Um limite de gasto",
        ],
  },
  {
    slug: "inteligencia",
    name: "Inteligência",
    price: "R$ 29,90",
    period: "/mês",
    tag: "Principal",
    highlight: true,
    annualNote: "ou R$ 239,90 por ano (cerca de R$ 20 por mês)",
    waitlistSource: "waitlist_inteligencia",
    summary: "Clareza, planejamento e evolução financeira real.",
    features: [
      "Tudo do gratuito",
      "Planejamento completo com múltiplos cenários",
      "Acompanhamento patrimonial e histórico",
      "Projetado × real: seu plano está no ritmo?",
      "“E se…?” e a menor idade para parar de trabalhar",
      "Raio-X do patrimônio, projeção do fim do mês e alertas de cobrança estranha",
      "Limites de gasto ilimitados",
    ],
  },
  {
    slug: "pro",
    name: "Pro",
    price: "R$ 59,90",
    period: "/mês",
    tag: "Futuro",
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

export const PRICING_NOTE = "Preços de lançamento ainda em teste. Nada é cobrado agora.";
