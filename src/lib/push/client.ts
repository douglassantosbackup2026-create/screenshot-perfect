// Notificações neste aparelho: pedir permissão, inscrever no push do navegador e guardar a inscrição
// em push_subscriptions (o servidor manda os lembretes). Só funciona com o service worker registrado,
// ou seja, no app publicado (não no preview do editor nem em desenvolvimento).
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env["VITE_VAPID_PUBLIC_KEY"] as string | undefined;

export type PushSupport = "ok" | "unsupported" | "install-first" | "not-configured";

/** iPhone e iPad só recebem push com o app instalado na tela inicial. */
function needsInstall(): boolean {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  if (!VAPID_PUBLIC_KEY) return "not-configured";
  if (needsInstall()) return "install-first";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return "ok";
}

/** Chave VAPID (base64url) no formato que o PushManager pede. */
export function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  // Sem service worker registrado (dev, iframe), ready nunca resolve: não espera para sempre.
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ?? null;
}

export async function pushEnabled(): Promise<boolean> {
  if (pushSupport() !== "ok" || Notification.permission !== "granted") return false;
  const reg = await registration();
  return !!(await reg?.pushManager.getSubscription());
}

/** Liga as notificações. Devolve uma mensagem de erro para mostrar, ou null se deu certo. */
export async function enablePush(userId: string): Promise<string | null> {
  if (pushSupport() !== "ok") return "Este aparelho não recebe notificações do app.";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "As notificações estão bloqueadas. Libere nas configurações do navegador para este site.";
  const reg = await registration();
  if (!reg) return "Abra o app instalado (ou o site publicado) para ligar as notificações.";
  const sub =
    (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY!) }));
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.["p256dh"] || !json.keys["auth"]) return "Não foi possível ligar as notificações.";
  const { error } = await supabase.from("push_subscriptions").insert({ user_id: userId, endpoint: json.endpoint, p256dh: json.keys["p256dh"], auth: json.keys["auth"] });
  // 23505: este aparelho já estava cadastrado.
  if (error && error.code !== "23505") {
    await sub.unsubscribe().catch(() => {});
    return "Não foi possível ligar as notificações. Tente de novo em instantes.";
  }
  return null;
}

export async function disablePush(): Promise<void> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe().catch(() => {});
}
