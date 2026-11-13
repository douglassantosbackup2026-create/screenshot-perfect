// Código de parceiro da visita (?ref=CODIGO) ou digitado no cadastro. Fica neste navegador por 30 dias
// e é ligado à conta no primeiro login (claim_referral). Nada aqui dá desconto.
import { supabase } from "@/integrations/supabase/client";

const REF_KEY = "mk_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type RefSource = "link" | "cupom";
type Stored = { code: string; source: RefSource; at: number };

const safe = <T,>(fn: () => T, fallback: T): T => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

/** Código de parceiro sugerido: primeiro nome sem acento + 2 dígitos (ex.: "MARIA42"). */
export function suggestCode(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .split(/\s+/)[0]
    ?.toUpperCase()
    .slice(0, 12);
  return `${base && base.length >= 2 ? base : "AFIL"}${Math.floor(10 + Math.random() * 90)}`;
}

export function normalizeRef(code: string): string | null {
  const c = code.trim().toUpperCase();
  return /^[A-Z0-9]{4,20}$/.test(c) ? c : null;
}

export function saveRef(code: string, source: RefSource) {
  const c = normalizeRef(code);
  if (!c) return;
  safe(() => window.localStorage.setItem(REF_KEY, JSON.stringify({ code: c, source, at: Date.now() } satisfies Stored)), undefined);
}

/** Guarda o ?ref= da página de entrada (o último link vale). */
export function captureRef(search: string) {
  const code = new URLSearchParams(search).get("ref");
  if (code) saveRef(code, "link");
}

export function currentRef(): Stored | null {
  if (typeof window === "undefined") return null;
  const s = safe(() => JSON.parse(window.localStorage.getItem(REF_KEY) ?? "null") as Stored | null, null);
  if (!s || Date.now() - s.at > TTL_MS) return null;
  return s;
}

export function clearRef() {
  safe(() => window.localStorage.removeItem(REF_KEY), undefined);
}

// Cupom de desconto do link (?cupom=CODIGO): preenche o campo na Assinatura. Quem confere é o servidor.
const COUPON_KEY = "mk_cupom";

export function captureCoupon(search: string) {
  const code = new URLSearchParams(search).get("cupom")?.trim().toUpperCase();
  if (code && /^[A-Z0-9]{3,20}$/.test(code))
    safe(() => window.localStorage.setItem(COUPON_KEY, JSON.stringify({ code, at: Date.now() })), undefined);
}

export function currentCoupon(): string | null {
  if (typeof window === "undefined") return null;
  const s = safe(() => JSON.parse(window.localStorage.getItem(COUPON_KEY) ?? "null") as { code: string; at: number } | null, null);
  return s && Date.now() - s.at <= TTL_MS ? s.code : null;
}

export function clearCoupon() {
  safe(() => window.localStorage.removeItem(COUPON_KEY), undefined);
}

/** Contas já conferidas nesta aba (a sessão renova várias vezes; basta perguntar uma). */
const checked = new Set<string>();

/**
 * Liga a conta conectada ao parceiro do código guardado aqui (ou do cadastro, se confirmou o e-mail em
 * outro aparelho). O banco decide se vale; depois de uma resposta, o código local sai.
 */
export async function claimPendingRef(user: { id: string; created_at: string; user_metadata?: Record<string, unknown> }) {
  const local = currentRef();
  // O banco só aceita nos primeiros 7 dias da conta: depois disso, nem pergunta.
  const recent = Date.now() - new Date(user.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
  if (checked.has(user.id) || !recent || (!local && !user.user_metadata?.["ref"])) return;
  checked.add(user.id);
  try {
    const { error } = await supabase.rpc("claim_referral", local ? { p_code: local.code, p_source: local.source } : {});
    if (error) checked.delete(user.id);
    else clearRef();
  } catch {
    checked.delete(user.id); // rede: tenta de novo quando a sessão renovar
  }
}
