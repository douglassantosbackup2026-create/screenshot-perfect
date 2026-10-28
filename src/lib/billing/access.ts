// Status da assinatura de quem está logado: lê `entitlements` (gravado só pelo webhook) e aplica
// resolveAccess. O guard de src/routes/_authenticated e as telas leem daqui.
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAccess, type Access } from "@/lib/entitlements/matrix";

export const BILLING_ENABLED = import.meta.env["VITE_BILLING_ENABLED"] === "true";
/** Só em desenvolvimento: localStorage "pi_tier_preview" = nenhum | inteligencia | pro simula a assinatura. */
const PREVIEW_KEY = "pi_tier_preview";
const CACHE_KEY = (userId: string) => `mitikos_access_${userId}`;

const OPEN: Access = resolveAccess({ billingEnabled: false, entitlement: null });
let current: Access = BILLING_ENABLED ? { tier: null, active: false, billingOff: false } : OPEN;
const listeners = new Set<() => void>();
const set = (a: Access) => {
  current = a;
  listeners.forEach((l) => l());
};

function preview(): Access | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const p = window.localStorage.getItem(PREVIEW_KEY);
  if (p === "nenhum") return { tier: null, active: false, billingOff: false };
  if (p === "inteligencia" || p === "pro") return { tier: p, active: true, billingOff: false };
  return null;
}

const readCache = (userId: string): Access | null => {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY(userId));
    return raw ? (JSON.parse(raw) as Access) : null;
  } catch {
    return null;
  }
};

/**
 * Busca a assinatura no banco. Sem internet, usa o último status salvo neste aparelho; se nunca houve
 * nenhum, deixa entrar: falta de conexão não é falta de pagamento (o banco continua a fonte da verdade).
 */
export async function loadAccess(userId: string): Promise<Access> {
  const p = preview();
  if (p) return (set(p), p);
  if (!BILLING_ENABLED) return (set(OPEN), OPEN);
  const { data, error } = await supabase.from("entitlements").select("plan, valid_until").eq("user_id", userId).maybeSingle();
  if (error) {
    const cached = readCache(userId) ?? { tier: null, active: true, billingOff: false };
    set(cached);
    return cached;
  }
  const a = resolveAccess({
    billingEnabled: true,
    entitlement: data ? { plan: data.plan, validUntil: data.valid_until } : null,
  });
  try {
    window.localStorage.setItem(CACHE_KEY(userId), JSON.stringify(a));
  } catch {
    /* sem armazenamento: só não guarda */
  }
  set(a);
  return a;
}

/** Admin usa o app sem assinatura (precisa chegar ao admin de conteúdo). */
export function grantAdminAccess() {
  set({ ...current, active: true });
}

/** Status atual, atualizado sempre que loadAccess roda. */
export function useAccess(): Access {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
    () => current,
  );
}
