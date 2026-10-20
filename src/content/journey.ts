// Jornada em 4 unidades, montada com as 21 lições de program.ts (o id da lição continua sendo `day`).
// STATUS: RASCUNHO — a ordem e os testes de nivelamento precisam de revisão profissional.

export type LessonWidget = "tempo" | "inflacao" | "juros";

export type Unit = {
  n: number;
  title: string;
  tag: string | null;
  description: string;
  /** Lições na ordem da trilha (ids de program.ts). */
  lessons: number[];
  /** O que a pessoa conquista ao terminar a unidade. */
  result: string;
  /** Perguntas existentes ({ dia, posição a partir de 1 }) para quem já domina a unidade. Vazio = sem teste. */
  placement: { day: number; position: number }[];
};

export const UNITS: Unit[] = [
  {
    n: 1,
    title: "Conheça sua realidade",
    tag: "Iniciante",
    description: "Tempo, inflação, o custo da vida que você quer, o INSS e a reserva de emergência.",
    lessons: [1, 2, 4, 5, 8],
    result: "Diagnóstico inicial",
    placement: [
      { day: 1, position: 1 },
      { day: 2, position: 1 },
      { day: 5, position: 1 },
    ],
  },
  {
    n: 2,
    title: "Planeje seu futuro",
    tag: null,
    description: "Idade-alvo, patrimônio necessário, cenários e seu primeiro plano.",
    lessons: [6, 7, 9, 11, 14],
    result: "Primeira projeção de aposentadoria",
    placement: [
      { day: 6, position: 1 },
      { day: 9, position: 1 },
      { day: 11, position: 1 },
    ],
  },
  {
    n: 3,
    title: "Entenda seus investimentos",
    tag: null,
    description: "Juros compostos, retorno real, custos, previdência e renda variável.",
    lessons: [3, 10, 12, 13, 16],
    result: "Comparar alternativas com mais clareza",
    placement: [
      { day: 3, position: 1 },
      { day: 10, position: 1 },
      { day: 12, position: 1 },
    ],
  },
  {
    n: 4,
    title: "Construa consistência",
    tag: null,
    description: "Pague-se primeiro, meses difíceis, revisões e seu primeiro registro.",
    lessons: [15, 17, 18, 19, 20, 21],
    result: "Acompanhamento contínuo da sua trajetória",
    // Unidade prática: não dá para pular com um teste.
    placement: [],
  },
];

/** Mini simulações dentro das lições, calculadas pelo motor determinístico. */
export const LESSON_WIDGETS: Partial<Record<number, LessonWidget>> = { 1: "tempo", 2: "inflacao", 3: "juros" };
