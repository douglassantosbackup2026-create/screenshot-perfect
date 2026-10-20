// Lembretes por e-mail: quem recebe hoje, o texto de cada lembrete e o link assinado para sair da lista.
// Funções puras (a assinatura usa a WebCrypto, presente no navegador e no servidor).

export type ReminderKind = "fechamento" | "missao";

export interface Recipient {
  userId: string;
  email: string;
  displayName: string | null;
  monthlyReminder: boolean;
  reminderDay: number;
  weeklyReminder: boolean;
}

/** Dia (1–31) e dia da semana ISO (1 = segunda) de uma data "YYYY-MM-DD". */
export function dayParts(today: string) {
  const d = new Date(today + "T12:00:00Z");
  return { day: d.getUTCDate(), isoWeekday: ((d.getUTCDay() + 6) % 7) + 1 };
}

/** Os lembretes de hoje: o mensal no dia escolhido (1 a 28) e o semanal às segundas. */
export function remindersFor(r: Recipient, today: string): ReminderKind[] {
  const { day, isoWeekday } = dayParts(today);
  const out: ReminderKind[] = [];
  if (r.monthlyReminder && r.reminderDay === day) out.push("fechamento");
  if (r.weeklyReminder && isoWeekday === 1) out.push("missao");
  return out;
}

/** Chave do envio, para nunca mandar o mesmo lembrete duas vezes no mesmo período. */
export function periodKey(kind: ReminderKind, today: string): string {
  if (kind === "fechamento") return `M:${today.slice(0, 7)}`;
  return `D:${today}`;
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** Assinatura HMAC-SHA256 do usuário, para o link de sair da lista funcionar sem login e sem ser adivinhado. */
export async function signUser(userId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`lembretes:${userId}`))).slice(0, 32);
}
export async function verifyUser(userId: string, token: string, secret: string): Promise<boolean> {
  const expected = await signUser(userId, secret);
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function layout(title: string, body: string, cta: { label: string; href: string }, unsubscribe: string) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#0c0c0b;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;color:#f0efec">
<p style="color:#f6c800;font-weight:700;letter-spacing:.08em;font-size:12px;text-transform:uppercase">Previdência Intelligence</p>
<h1 style="font-size:22px;line-height:1.3;margin:8px 0 16px">${title}</h1>
${body}
<p style="margin:28px 0"><a href="${cta.href}" style="background:#f6c800;color:#0c0c0b;padding:14px 22px;border-radius:999px;font-weight:700;text-decoration:none">${cta.label}</a></p>
<p style="color:#8a8984;font-size:12px;line-height:1.5">Você recebe este lembrete porque ligou os lembretes no app. <a href="${unsubscribe}" style="color:#8a8984">Não quero mais receber</a>.</p>
</div></body></html>`;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** E-mail do fechamento do mês. Nunca inclui valores: o lembrete pode ser lido por outra pessoa no celular. */
export function monthCloseEmail(name: string | null, today: string, site: string, unsubscribe: string) {
  const month = MONTHS[Number(today.slice(5, 7)) - 1]!;
  const hi = name ? `${esc(name)}, ` : "";
  const body = `<p style="color:#c3c2b7;line-height:1.6">${hi}é dia de fechar ${month}: lançar o mês, categorizar, conferir o orçamento, fazer o aporte e atualizar o patrimônio. Uns 10 minutos.</p>`;
  return {
    subject: `Seu fechamento de ${month} está esperando`,
    html: layout(`Hora de fechar ${month}`, body, { label: "Fechar o mês", href: `${site}/fechamento` }, unsubscribe),
    text: `${hi}é dia de fechar ${month}. Leva uns 10 minutos: ${site}/fechamento\n\nPara não receber mais: ${unsubscribe}`,
    headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

/** E-mail da missão da semana. */
export function weeklyMissionEmail(name: string | null, mission: { title: string; description: string }, site: string, unsubscribe: string) {
  const hi = name ? `${esc(name)}, ` : "";
  const body = `<p style="color:#c3c2b7;line-height:1.6">${hi}a missão desta semana é <strong style="color:#f0efec">${esc(mission.title)}</strong>. ${esc(mission.description)}</p>`;
  return {
    subject: `Missão da semana: ${mission.title}`,
    html: layout("Uma missão curta para esta semana", body, { label: "Ver a missão", href: `${site}/hoje` }, unsubscribe),
    text: `${hi}a missão desta semana é ${mission.title}. ${mission.description} ${site}/hoje\n\nPara não receber mais: ${unsubscribe}`,
    headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}
