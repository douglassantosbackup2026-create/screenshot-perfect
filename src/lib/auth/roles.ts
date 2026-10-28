import { supabase } from "@/integrations/supabase/client";

/** Papel de admin vem do banco (user_roles); sem sessão ou com erro, não é admin. */
export async function isAdmin(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { data, error } = await supabase.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
  return !error && data === true;
}
