// Envio de Web Push (RFC 8291/8292) pela WebCrypto: roda no Worker sem dependências do Node.
// Só no servidor: usa a chave privada VAPID.
import { buildPushPayload, type VapidKeys } from "@block65/webcrypto-web-push";
import type { PushPayload } from "./reminders";

export type StoredSubscription = { endpoint: string; p256dh: string; auth: string };

export function vapidFromEnv(): VapidKeys | null {
  const publicKey = process.env["VAPID_PUBLIC_KEY"] || process.env["VITE_VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"];
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

/**
 * Manda uma notificação para um aparelho. "gone": o aparelho cancelou ou a inscrição venceu (404/410)
 * e a linha deve ser apagada; "error": falha passageira, tenta no próximo lembrete.
 */
export async function sendPush(sub: StoredSubscription, payload: PushPayload, vapid: VapidKeys): Promise<"ok" | "gone" | "error"> {
  try {
    const req = await buildPushPayload(
      { data: payload, options: { ttl: 24 * 60 * 60, urgency: "normal", topic: payload.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } },
      { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      vapid,
    );
    const res = await fetch(sub.endpoint, { ...req, signal: AbortSignal.timeout(10_000) });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "ok" : "error";
  } catch (e) {
    console.error("push failed", e instanceof Error ? e.message : e);
    return "error";
  }
}
