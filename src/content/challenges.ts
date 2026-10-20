// Desafios pessoais. STATUS: RASCUNHO.
// Medem comportamento (aprender, revisar, registrar), nunca o tamanho do patrimônio.
import type { ChallengeDef } from "@/lib/gamification/rules";

export const CHALLENGES: ChallengeDef[] = [
  {
    slug: "sete-dias-em-dez",
    title: "7 dias ativos em 10",
    description: "Faça uma lição, missão, revisão ou registro em 7 dos próximos 10 dias.",
    metric: "active_days",
    target: 7,
    windowDays: 10,
  },
  {
    slug: "quatro-missoes",
    title: "4 missões em 4 semanas",
    description: "Complete a missão da semana por quatro semanas.",
    metric: "missions",
    target: 4,
    windowDays: 28,
  },
  {
    slug: "patrimonio-tres-meses",
    title: "Patrimônio em 3 meses",
    description: "Registre seu patrimônio em três meses diferentes. Vale qualquer valor.",
    metric: "wealth_months",
    target: 3,
    windowDays: 92,
  },
  {
    slug: "revisar-orcamento",
    title: "Revisar o orçamento",
    description: "Faça uma revisão rápida do plano e confira se o aporte ainda cabe no mês.",
    metric: "plan_reviews",
    target: 1,
    windowDays: 7,
  },
  {
    slug: "primeira-meta-concluida",
    title: "Uma meta até o fim",
    description: "Conclua uma meta que você definiu nos próximos 30 dias.",
    metric: "goals_completed",
    target: 1,
    windowDays: 30,
  },
];

export const challengeBySlug = (slug: string) => CHALLENGES.find((c) => c.slug === slug);
