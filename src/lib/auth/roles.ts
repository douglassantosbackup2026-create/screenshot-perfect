import { supabase } from "@/integrations/supabase/client";
import type { StaffRole } from "@/lib/admin/modules";

/**
 * Papel de admin vem do banco (user_roles), sempre de quem está conectado: is_admin() não recebe id,
 * então ninguém pergunta sobre outra conta. Sem sessão ou com erro, não é admin.
 * Segundo fator: opcional para admin, mas quem o ativou precisa dele também aqui (migration 20261112120000).
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

export type StaffStatus = { roles: StaffRole[]; mfaNeeded: boolean };

/** Perfis da equipe de quem está conectado (my_staff_status). Sem sessão ou com erro: nenhum. */
export async function staffStatus(): Promise<StaffStatus> {
  const { data, error } = await supabase.rpc("my_staff_status");
  if (error || !data) return { roles: [], mfaNeeded: false };
  const s = data as { roles?: StaffRole[]; mfa_needed?: boolean };
  return { roles: Array.isArray(s.roles) ? s.roles : [], mfaNeeded: s.mfa_needed === true };
}

/** Para as telas de admin: libera, manda ativar/confirmar o segundo fator, ou nega. */
export async function adminGate(): Promise<"ok" | "mfa" | "no"> {
  if (await isAdmin()) return "ok";
  return (await hasAdminRole()) ? "mfa" : "no";
}
