import { supabase } from "@/integrations/supabase/client";

/**
 * Papel de admin vem do banco (user_roles), sempre de quem está conectado: is_admin() não recebe id,
 * então ninguém pergunta sobre outra conta. Sem sessão ou com erro, não é admin.
 * O segundo fator é opcional também para admin (migration 20261108120000).
 */
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}

/** Tem o papel de admin, mesmo sem o segundo fator (para mandar ativar). */
export async function hasAdminRole(): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_admin_role");
  return !error && data === true;
}

/** Para as telas de admin: libera, manda ativar/confirmar o segundo fator, ou nega. */
export async function adminGate(): Promise<"ok" | "mfa" | "no"> {
  if (await isAdmin()) return "ok";
  return (await hasAdminRole()) ? "mfa" : "no";
}
