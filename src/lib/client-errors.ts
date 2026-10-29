// Erros do navegador em produção: vão para /api/public/client-error, que só registra no log do servidor.
// Manda só mensagem, stack e rota (nunca dados da pessoa) e no máximo MAX_PER_PAGE por página aberta.
const ENDPOINT = "/api/public/client-error";
const MAX_PER_PAGE = 10;
let sent = 0;
const seen = new Set<string>();

export type ClientErrorKind = "boundary" | "root" | "onerror" | "unhandledrejection";

export function reportClientError(error: unknown, kind: ClientErrorKind) {
  if (typeof window === "undefined" || import.meta.env.DEV || sent >= MAX_PER_PAGE) return;
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
  const stack = error instanceof Error ? (error.stack ?? "").slice(0, 4000) : "";
  // O mesmo erro repetido (um render em loop, por exemplo) conta uma vez só.
  const key = `${kind}:${message}`;
  if (seen.has(key)) return;
  seen.add(key);
  sent++;
  const body = JSON.stringify({ kind, message, stack, path: window.location.pathname.slice(0, 200) });
  try {
    if (!navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" })))
      void fetch(ENDPOINT, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    /* relatar erro nunca pode gerar outro */
  }
}

/** Liga a captura de erros que escapam do React (chamar uma vez, no navegador). */
export function installClientErrorReporting() {
  window.addEventListener("error", (e) => reportClientError(e.error ?? e.message, "onerror"));
  window.addEventListener("unhandledrejection", (e) => reportClientError(e.reason, "unhandledrejection"));
}
