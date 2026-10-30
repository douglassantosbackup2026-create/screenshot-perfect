// Envio pela Cloud API do WhatsApp, só no servidor (o token vem do ambiente na hora da chamada).
import { toGraphPayload, type Outbound } from "./outbound";

const TIMEOUT_MS = 10_000;

export type WhatsAppConfig = { token: string; phoneNumberId: string; appSecret: string; verifyToken: string; graphVersion: string };

/** Configuração do WhatsApp, ou null se faltar algum segredo (o webhook responde 503 e nada é enviado). */
export function whatsappConfig(): WhatsAppConfig | null {
  const token = process.env["WHATSAPP_TOKEN"];
  const phoneNumberId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  const appSecret = process.env["WHATSAPP_APP_SECRET"];
  const verifyToken = process.env["WHATSAPP_VERIFY_TOKEN"];
  if (!token || !phoneNumberId || !appSecret || !verifyToken) return null;
  return { token, phoneNumberId, appSecret, verifyToken, graphVersion: process.env["WHATSAPP_GRAPH_VERSION"] || "v21.0" };
}

/** Envia uma resposta. Devolve false em erro (já registrado no log); quem chama não precisa tentar de novo. */
export async function sendWhatsApp(cfg: WhatsAppConfig, to: string, out: Outbound): Promise<boolean> {
  try {
    const res = await fetch(`https://graph.facebook.com/${cfg.graphVersion}/${cfg.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(toGraphPayload(to, out)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`WhatsApp send failed [${res.status}]: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("WhatsApp send error", e);
    return false;
  }
}
