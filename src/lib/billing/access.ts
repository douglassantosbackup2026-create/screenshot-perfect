// Status da assinatura de quem está logado: lê `entitlements` (gravado só pelo webhook) e aplica
// resolveAccess. O guard de src/routes/_authenticated e as telas leem daqui.
import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { entitlementFromCache, resolveAccess, type Access, type Entitlement } from "@/lib/entitlements/matrix";

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

function readCache(userId: string): Entitlement | null {
  try {
    return entitlementFromCache(window.localStorage.getItem(CACHE_KEY(userId)));
  } catch {
    return null;
  }
}

function writeCache(userId: string, e: Entitlement | null) {
  try {
    if (e) window.localStorage.setItem(CACHE_KEY(userId), JSON.stringify({ ...e, checkedAt: Date.now() }));
    else window.localStorage.removeItem(CACHE_KEY(userId));
  } catch {
    /* sem armazenamento: só não guarda */
  }
}

/**
 * Busca a assinatura no banco. Se a consulta falhar, vale a última assinatura lida neste aparelho nas
 * últimas 24 h (ainda conferindo a validade); sem ela, não entra. O banco continua a fonte da verdade.
 */
export async function loadAccess(userId: string): Promise<Access> {
  const p = preview();
  if (p) return (set(p), p);
  if (!BILLING_ENABLED) return (set(OPEN), OPEN);
  const { data, error } = await supabase.from("entitlements").select("plan, valid_until").eq("user_id", userId).maybeSingle();
  const entitlement = error ? readCache(userId) : data ? { plan: data.plan, validUntil: data.valid_until } : null;
  if (!error) writeCache(userId, entitlement);
  const a = resolveAccess({ billingEnabled: true, entitlement });
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
