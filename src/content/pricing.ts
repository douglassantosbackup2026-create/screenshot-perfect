// Preços apenas para exibição (spec §15). Sem cobrança até o Gate 2.
// Os valores são hipóteses iniciais para testar, não preços validados por pesquisa.
export type PlanTier = {
  slug: "free" | "inteligencia" | "pro";
  name: string;
  price: string;
  period: string | null;
  tag: string;
  highlight: boolean;
  /** Origem gravada em `leads.source` pela lista de espera; null para o plano gratuito. */
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
    tag: "Principal",
    highlight: true,
    waitlistSource: "waitlist_inteligencia",
    summary: "Clareza, planejamento e evolução financeira real.",
    features: [
      "Tudo do gratuito",
      "Planejamento completo com múltiplos cenários",
      "Acompanhamento patrimonial e histórico",
      "Relatórios da sua evolução",
      "Recursos avançados de IA",
    ],
  },
  {
    slug: "free",
    name: "Gratuito",
    price: "R$ 0",
    period: null,
    tag: "Para começar",
    highlight: false,
    waitlistSource: null,
    summary: "Crie o hábito de cuidar do seu futuro, alguns minutos por dia.",
    features: [
      "Jornada em 4 unidades, missão do dia e da semana",
      "XP, níveis e conquistas",
      "Sequência de dias e de semanas, sem punição por perder um dia",
      "Uma simulação de aposentadoria",
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
