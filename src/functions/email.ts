// Envio de e-mail pelo Resend, usado pelos leads e pelos lembretes. Só roda no servidor (lê segredos do ambiente).
export type EmailMessage = { subject: string; html: string; text: string; headers?: Record<string, string> };

/** Envia um e-mail. Sem RESEND_API_KEY, não envia e devolve false. */
export async function sendEmail(to: string, msg: EmailMessage): Promise<boolean> {
  const key = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM"] ?? "Previdência Intelligence <resultado@resend.dev>";
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: msg.subject, html: msg.html, text: msg.text, headers: msg.headers }),
  });
  return res.ok;
}
