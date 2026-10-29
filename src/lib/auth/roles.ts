import { supabase } from "@/integrations/supabase/client";

/**
 * Papel de admin vem do banco (user_roles), sempre de quem está conectado: is_admin() não recebe id,
 * então ninguém pergunta sobre outra conta. Sem sessão ou com erro, não é admin.
 */
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}
