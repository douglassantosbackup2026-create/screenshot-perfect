// Missões semanais (spec §11). STATUS: RASCUNHO.
export type Mission = { order: number; slug: string; title: string; description: string; hint: "plan_quick_review" | "micro_lesson" | "challenge" | "reflection" };
export const MISSIONS: Mission[] = [
 {
  "order": 1,
  "slug": "revisao-relampago",
  "title": "Revisão relâmpago",
  "description": "Confira se a renda desejada ainda faz sentido para você.",
  "hint": "plan_quick_review"
 },
 {
  "order": 2,
  "slug": "juros-compostos-de-novo",
  "title": "Juros compostos, de novo",
  "description": "Uma lição de 2 minutos para fixar a regra dos 72.",
  "hint": "micro_lesson"
 },
 {
  "order": 3,
  "slug": "desafio-48-horas",
  "title": "Desafio das 48 horas",
  "description": "Adie por 48 horas uma compra que não estava planejada.",
  "hint": "challenge"
 },
 {
  "order": 4,
  "slug": "olhe-os-custos",
  "title": "Olhe os custos",
  "description": "Anote a taxa de administração e a de carregamento do seu plano, se tiver um.",
  "hint": "reflection"
 },
 {
  "order": 5,
  "slug": "cenario-conservador",
  "title": "Teste o cenário conservador",
  "description": "Veja quanto o aporte necessário muda no cenário conservador.",
  "hint": "plan_quick_review"
 },
 {
  "order": 6,
  "slug": "meses-de-reserva",
  "title": "Quantos meses de reserva?",
  "description": "Calcule quantos meses de despesas sua reserva já cobre.",
  "hint": "reflection"
 },
 {
  "order": 7,
  "slug": "inflacao-de-novo",
  "title": "Inflação, de novo",
  "description": "Uma lição de 2 minutos sobre poder de compra.",
  "hint": "micro_lesson"
 },
 {
  "order": 8,
  "slug": "conte-para-alguem",
  "title": "Conte para alguém",
  "description": "Compartilhe uma conquista, sem valores, com alguém de confiança.",
  "hint": "challenge"
 }
];
