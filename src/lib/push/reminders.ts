// Lembretes por notificação push: quem recebe hoje e o texto. Funções puras.
// O texto nunca leva valores: a notificação aparece na tela bloqueada.

export type ReminderKind = "fechamento";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Lembretes de hoje para quem escolheu `reminderDay` (1 a 28) no Perfil. `today` é "YYYY-MM-DD" (São Paulo). */
export function remindersFor(reminderDay: number, today: string): ReminderKind[] {
  return Number(today.slice(8, 10)) === reminderDay ? ["fechamento"] : [];
}

/** Chave do envio: o mesmo lembrete nunca sai duas vezes no mesmo mês (reminder_log). */
export function periodKey(kind: ReminderKind, today: string): string {
  return kind === "fechamento" ? `M:${today.slice(0, 7)}` : `D:${today}`;
}

export type PushPayload = { title: string; body: string; url: string; tag: string };

/** O dia escolhido é o do dinheiro entrando: hora de lançar o mês anterior e fazer o aporte. */
export function reminderPush(kind: ReminderKind, today: string): PushPayload {
  const month = MONTHS[Number(today.slice(5, 7)) - 1]!;
  return {
    title: `Hora de fechar ${month}`,
    body: "Lançar, conferir o orçamento, fazer o aporte e atualizar o patrimônio: uns 10 minutos.",
    url: "/fechamento",
    tag: `${kind}-${today.slice(0, 7)}`,
  };
}
