// Confirmar a identidade antes de uma ação irreversível (excluir a conta). O banco exige login nos
// últimos 10 minutos (_recent_auth em delete_my_account): entrar de novo com a senha renova isso.
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "./password";
import { verifiedTotpId, verifyTotp } from "./mfa";

/** Conta com senha? (quem entrou só pelo Google confirma entrando de novo pelo Google). */
export async function usesPassword(): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  return (data.user?.app_metadata?.["providers"] as string[] | undefined)?.includes("email") ?? data.user?.app_metadata?.["provider"] === "email";
}

/** Confirma senha (e código, se o segundo fator estiver ativo). Devolve a mensagem de erro, ou null. */
export async function confirmIdentity(password: string, code: string): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) return "Entre de novo para continuar.";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return authErrorMessage(error.message);
  const factorId = await verifiedTotpId().catch(() => null);
  if (factorId && !(await verifyTotp(factorId, code))) return "Código inválido ou vencido. Confira o app autenticador.";
  return null;
}
