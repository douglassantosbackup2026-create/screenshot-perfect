import { ACHIEVEMENTS, type AchievementCode } from "@/lib/gamification/rules";
import { APP_NAME } from "@/lib/seo";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-10-01" → "outubro" */
export const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1];
export const monthShort = (month: string) => SHORT[Number(month.slice(5, 7)) - 1];
export const monthYear = (month: string) => {
  const n = monthName(month) ?? "";
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} de ${month.slice(0, 4)}`;
};

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

export const achievementInfo = (code: AchievementCode) => ACHIEVEMENTS.find((a) => a.code === code)!;

export const WORK_TYPES = [
  { value: "pj", label: "PJ" },
  { value: "autonomo", label: "Autônomo" },
  { value: "mei", label: "MEI" },
  { value: "clt", label: "CLT" },
  { value: "servidor", label: "Servidor público" },
  { value: "outro", label: "Outro" },
] as const;

export const DESTINATIONS = [
  { value: "previdencia", label: "Previdência" },
  { value: "investimentos", label: "Investimentos" },
  { value: "reserva", label: "Reserva" },
  { value: "outro", label: "Outro" },
] as const;

export const REASON_LABEL: Record<string, string> = {
  created: "Plano criado",
  edit: "Edição",
  quick_review: "Revisão rápida",
  life_event: "Mudança de vida",
  annual_review: "Revisão anual",
  what_if: "Simulação “E se…?”",
};

export const SIMULATION_FOOTER =
  "Simulação educativa, em valores de hoje, feita com as premissas que você escolheu. Não considera impostos e só considera custos se você os informar. Não é recomendação de investimento nem garantia de resultado.";
export const INSS_HELP =
  "Use a estimativa que aparece no Meu INSS. O app não calcula benefícios do INSS; ele apenas usa o valor que você informar.";
export const ABOUT_TEXT =
  `O ${APP_NAME} é uma ferramenta de educação e planejamento. Não somos banco, corretora, seguradora nem consultoria de investimentos. Não vendemos produtos financeiros, não pedimos senhas e não movimentamos dinheiro.`;
export const lessonFooter = (date: string) =>
  `Conteúdo educativo revisado em ${date}. Não é recomendação individual de investimento. Regras e valores oficiais podem mudar; confira sempre a fonte.`;

/** Valor em dinheiro escondido (privacidade por padrão). */
export const HIDDEN = "R$ •••";

/** Formata um valor ou o esconde, conforme a preferência de mostrar valores. */
export const maskMoney =
  (show: boolean, fmt: (v: number) => string) =>
  (v: number): string =>
    show ? fmt(v) : HIDDEN;
