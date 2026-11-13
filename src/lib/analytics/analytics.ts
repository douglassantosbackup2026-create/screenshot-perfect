// Analytics próprio (tabela analytics_events no Supabase), só com consentimento.
// Sem "aceito" no banner: nada é enviado e nenhum id é criado no navegador.
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/** Muda quando a política de privacidade muda o que coleta: o banner volta a perguntar. */
export const POLICY_VERSION = "2026-11-02";

export const FUNNEL_EVENTS = ["landing_view", "calculator_used", "lead_saved", "signup_completed", "checkout_started"] as const;
export type ClientEvent =
  | (typeof FUNNEL_EVENTS)[number]
  | "session_start"
  | "calculator_started"
  | "calculator_completed"
  | "feature_used";

export type ConsentChoice = "aceito" | "recusado";
type StoredConsent = { choice: ConsentChoice; version: string; at: string };

const CONSENT_KEY = "mk_consent";
const ANON_KEY = "mk_anon";
const UTM_KEY = "mk_utm";
/** Conta já ligada a este navegador (para não registrar o consentimento a cada login). */
const LINKED_KEY = "mk_consent_user";
const OPEN_EVENT = "mk:open-consent";

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/** Escolha atual; uma escolha de outra versão da política conta como "ainda não escolheu". */
export function readConsent(raw: string | null, version = POLICY_VERSION): ConsentChoice | null {
  if (!raw) return null;
  const c = safe(() => JSON.parse(raw) as Partial<StoredConsent>, {});
  if (c.version !== version || (c.choice !== "aceito" && c.choice !== "recusado")) return null;
  return c.choice;
}

export function getConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  return readConsent(safe(() => window.localStorage.getItem(CONSENT_KEY), null));
}

/** UTMs da URL (só as três que o funil usa, cortadas no tamanho do banco). */
export function parseUtm(search: string): { source?: string; medium?: string; campaign?: string } {
  const p = new URLSearchParams(search);
  const out: { source?: string; medium?: string; campaign?: string } = {};
  for (const k of ["source", "medium", "campaign"] as const) {
    const v = p.get(`utm_${k}`)?.trim();
    if (v) out[k] = v.slice(0, 100);
  }
  return out;
}

/**
 * Guarda as UTMs da primeira página da visita (na sessão, que some ao fechar a aba). Chamado em toda
 * navegação; uma URL sem UTM não apaga as que já estão guardadas.
 */
export function captureUtm(search: string) {
  const utm = parseUtm(search);
  if (!Object.keys(utm).length) return;
  safe(() => window.sessionStorage.setItem(UTM_KEY, JSON.stringify(utm)), undefined);
}

export function currentUtm(): { source?: string; medium?: string; campaign?: string } {
  if (typeof window === "undefined") return {};
  return safe(() => JSON.parse(window.sessionStorage.getItem(UTM_KEY) ?? "{}") as Record<string, string>, {});
}

function anonId(create: boolean): string | null {
  return safe(() => {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id && create) {
      id = crypto.randomUUID();
      window.localStorage.setItem(ANON_KEY, id);
    }
    return id;
  }, null);
}

/** Grava a escolha do banner (no navegador e no banco). Recusar apaga o id do navegador. */
export async function setConsent(choice: ConsentChoice) {
  const stored: StoredConsent = { choice, version: POLICY_VERSION, at: new Date().toISOString() };
  safe(() => window.localStorage.setItem(CONSENT_KEY, JSON.stringify(stored)), undefined);
  const anon = choice === "aceito" ? anonId(true) : anonId(false);
  if (choice === "recusado") safe(() => window.localStorage.removeItem(ANON_KEY), undefined);
  safe(() => window.localStorage.removeItem(LINKED_KEY), undefined);
  window.dispatchEvent(new Event(OPEN_EVENT + ":changed"));
  try {
    await supabase.rpc("record_consent", { p_anon: anon as unknown as string, p_choice: choice, p_version: POLICY_VERSION });
  } catch {
    /* sem rede: a escolha local vale; o registro tenta de novo no próximo login */
  }
}

/**
 * Depois do login: leva a escolha deste navegador para a conta (uma vez por conta). Assim o servidor
 * sabe se pode registrar a assinatura no funil e o funil liga o navegador à conta.
 */
export async function linkConsentToUser(userId: string) {
  const choice = getConsent();
  if (!choice || safe(() => window.localStorage.getItem(LINKED_KEY), null) === userId) return;
  try {
    const { error } = await supabase.rpc("record_consent", { p_anon: (choice === "aceito" ? anonId(false) : null) as unknown as string, p_choice: choice, p_version: POLICY_VERSION });
    if (!error) safe(() => window.localStorage.setItem(LINKED_KEY, userId), undefined);
  } catch {
    /* tenta de novo no próximo login */
  }
}

/** Envia um evento do funil se a pessoa aceitou. Nunca lança nem atrasa quem chama. */
export function track(name: ClientEvent, props: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined" || getConsent() !== "aceito") return;
  const anon = anonId(true);
  if (!anon) return;
  // Sessão: id aleatório da aba (some ao fechar), criado só com aceite. O primeiro evento da aba abre a sessão.
  let session = safe(() => window.sessionStorage.getItem(SESSION_KEY), null);
  if (!session) {
    session = crypto.randomUUID();
    safe(() => window.sessionStorage.setItem(SESSION_KEY, session!), undefined);
    send(anon, "session_start", { session });
  }
  send(anon, name, { ...props, session });
}

function send(anon: string, name: ClientEvent, props: Record<string, string | number | boolean>) {
  void Promise.resolve(
    supabase.rpc("track_event", {
      p_anon: anon,
      p_name: name,
      p_path: window.location.pathname,
      p_utm: currentUtm() as Json,
      p_props: props as Json,
    }),
  ).catch(() => {});
}

const SESSION_KEY = "mk_session";

/** Páginas públicas cuja visita entra na contagem anônima (a mesma lista do banco, count_anonymous). */
export const COUNTED_PAGES = ["/", "/calculadora", "/cadastro", "/entrar", "/parceiros", "/planos", "/contato"] as const;
export type AnonymousKey = `visita:${(typeof COUNTED_PAGES)[number]}` | "simulacao_iniciada" | "simulacao_concluida";

/**
 * Contagem anônima: soma 1 no total do dia, com ou sem aceite. Não envia id, página fora da lista
 * nem nada que identifique a pessoa (a tabela só tem dia, chave e total).
 */
export function countAnonymous(key: AnonymousKey) {
  if (typeof window === "undefined") return;
  void Promise.resolve(supabase.rpc("count_anonymous", { p_key: key })).catch(() => {});
}

/** Áreas do app medidas em "Uso das funcionalidades" (primeiro trecho da rota → nome da área). */
const FEATURE_AREAS: Record<string, string> = {
  hoje: "inicio",
  diario: "lancamentos",
  orcamento: "orcamento",
  contas: "contas",
  plano: "plano",
  patrimonio: "patrimonio",
  evolucao: "progresso",
  fechamento: "fechamento",
};

/** Uso de uma área do app (só com aceite), uma vez por área em cada sessão. */
export function trackFeature(pathname: string) {
  const area = FEATURE_AREAS[pathname.split("/")[1] ?? ""];
  if (!area || typeof window === "undefined" || getConsent() !== "aceito") return;
  const key = `mk_feature_${area}`;
  if (safe(() => window.sessionStorage.getItem(key), null)) return;
  safe(() => window.sessionStorage.setItem(key, "1"), undefined);
  track("feature_used", { area });
}

/** Conta a visita de uma página pública da lista (outras páginas são ignoradas). */
export function countVisit(pathname: string) {
  if ((COUNTED_PAGES as readonly string[]).includes(pathname)) countAnonymous(`visita:${pathname}` as AnonymousKey);
}

/** Abre o banner de novo (Perfil e rodapé: "Preferências de privacidade"). */
export function openConsentPreferences() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}
export const CONSENT_EVENTS = { open: OPEN_EVENT, changed: OPEN_EVENT + ":changed" } as const;
