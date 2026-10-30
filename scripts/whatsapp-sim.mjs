// Simulador do WhatsApp para testar o webhook sem a Meta: manda mensagens assinadas como a Cloud API.
// Uso (com `npm run dev` rodando e os segredos WHATSAPP_* no .env local):
//   WHATSAPP_APP_SECRET=... node scripts/whatsapp-sim.mjs 5511999990000 "gastei 62 na farmácia"
//   node scripts/whatsapp-sim.mjs 5511999990000 --reply "undo:<id do lançamento>"
// As respostas não chegam a um celular: aparecem no log do servidor (ou falham no envio, se o token for falso).
import { createHmac, randomUUID } from "node:crypto";

const [, , from, ...rest] = process.argv;
const secret = process.env.WHATSAPP_APP_SECRET;
const url = process.env.WEBHOOK_URL ?? "http://localhost:8080/api/public/whatsapp/webhook";
if (!from || !rest.length || !secret) {
  console.error('Uso: WHATSAPP_APP_SECRET=... node scripts/whatsapp-sim.mjs <telefone> "<texto>" | --reply <id>');
  process.exit(1);
}
const isReply = rest[0] === "--reply";
const message = {
  id: `wamid.sim.${randomUUID()}`,
  from,
  timestamp: String(Math.floor(Date.now() / 1000)),
  ...(isReply
    ? { type: "interactive", interactive: { type: "button_reply", button_reply: { id: rest[1], title: "" } } }
    : { type: "text", text: { body: rest.join(" ") } }),
};
const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messages: [message] } }] }] });
const signature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signature }, body });
console.log(res.status, await res.text());
