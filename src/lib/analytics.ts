// Analytics de funil (PostHog), só com consentimento e nunca com valores financeiros.
// Sem VITE_POSTHOG_KEY no ambiente, não envia nada. Envio por fetch na API de captura, sem dependência nova.
import type { DemoState } from "@/lib/data/demo-store";

const CONSENT_KEY = "pi_analytics_consent"; // "1" aceitou, "0" recusou; ausente = ainda não perguntado
const ID_KEY = "pi_analytics_id";
const KEY = import.meta.env["VITE_POSTHOG_KEY"] as string | undefined;
const HOST = ((import.meta.env["VITE_POSTHOG_HOST"] as string | undefined) ?? "https://us.i.posthog.com").replace(/\/+$/, "");

export type FunnelEvent =
  | "landing_view"
  | "calc_done"
  | "signup_start"
  | "signup_done"
  | "login"
  | "onboarding_start"
  | "onboarding_done"
  | "first_account"
  | "first_transaction"
  | "statement_imported"
  | "budget_planned"
  | "contribution_logged"
  | "investment_logged"
  | "month_closed"
  | "lesson_completed"
  | "pricing_view"
  | "checkout_start"
  | "checkout_done";

type Props = Record<string, string | number | boolean | null>;

const safe = <T>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const analyticsEnabled = () => !!KEY;
/** null = ainda não perguntado. */
export const getConsent = (): boolean | null =>
  safe(() => {
    const v = window.localStorage.getItem(CONSENT_KEY);
    return v === null ? null : v === "1";
  }, null);
export function setConsent(on: boolean) {
  safe(() => window.localStorage.setItem(CONSENT_KEY, on ? "1" : "0"), undefined);
  listeners.forEach((l) => l());
}
const listeners = new Set<() => void>();
export function onConsentChange(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function distinctId(): string {
  return safe(() => {
    let id = window.localStorage.getItem(ID_KEY);
    if (!id) {
      id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
      window.localStorage.setItem(ID_KEY, id);
    }
    return id;
  }, "anon");
}

/** Só propriedades simples e sem dinheiro: nada de valores, saldos, nomes ou e-mails. */
const MONEY = /valor|amount|saldo|balance|total|renda|income|wealth|patrimonio|aporte|price|preco|email|nome|name/i;
function clean(props: Props = {}): Props {
  return Object.fromEntries(Object.entries(props).filter(([k, v]) => !MONEY.test(k) && (typeof v !== "string" || v.length <= 40)));
}

/** Envia um evento do funil (se houver chave e consentimento). Nunca lança erro. */
export function track(event: FunnelEvent, props?: Props) {
  if (!KEY || typeof window === "undefined" || getConsent() !== true) return;
  const body = JSON.stringify({
    api_key: KEY,
    event,
    distinct_id: distinctId(),
    properties: { ...clean(props), $current_url: window.location.pathname, $lib: "pi-web" },
    timestamp: new Date().toISOString(),
  });
  safe(() => {
    if (navigator.sendBeacon?.(`${HOST}/capture/`, new Blob([body], { type: "application/json" }))) return;
    void fetch(`${HOST}/capture/`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  }, undefined);
}

/** Liga o id anônimo à conta depois do login, para o funil seguir a mesma pessoa. */
export function identify(userId: string) {
  if (!KEY || getConsent() !== true) return;
  const body = JSON.stringify({ api_key: KEY, event: "$identify", distinct_id: userId, properties: { $anon_distinct_id: distinctId() } });
  void fetch(`${HOST}/capture/`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  safe(() => window.localStorage.setItem(ID_KEY, userId), undefined);
}

/** Eventos que saem das operações do app (ligado em observeOps). */
export function trackOp(op: string, prev: DemoState, next: DemoState) {
  if (op === "saveAccount" && prev.accounts.length === 0 && next.accounts.length > 0) track("first_account");
  if (op === "addTransaction" && prev.transactions.filter((t) => t.source === "manual").length === 0) track("first_transaction");
  if (op === "importTransactions" && next.transactions.length > prev.transactions.length) track("statement_imported");
  if ((op === "setAssigned" || op === "applyTemplates") && next.xpEvents.length > prev.xpEvents.length) track("budget_planned");
  if (op === "logContribution" || (op === "addTransfer" && next.contributions.length > prev.contributions.length)) track("contribution_logged");
  if (op === "addTrade") track("investment_logged");
  if (op === "closeMonth") track("month_closed");
  if (op === "completeLesson" && Object.keys(next.lessonCompletions).length > Object.keys(prev.lessonCompletions).length)
    track("lesson_completed", { lessons: Object.keys(next.lessonCompletions).length });
}
