// Segundo fator (TOTP, app autenticador) pelo Supabase Auth.
// Quem ativa passa a precisar do código a cada login: o banco só libera os dados dessa pessoa com sessão
// aal2 (_mfa_ok, migration 20261107120000). É opcional para todos, inclusive admin.
import { supabase } from "@/integrations/supabase/client";

/**
 * A sessão atual ainda precisa do código (o segundo fator está ativo, mas não foi confirmado neste login).
 * Na dúvida responde false: quem garante é o banco, que esconde os dados sem aal2.
 */
export async function needsMfaStep(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return false;
    return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
  } catch {
    return false;
  }
}

/** Id do app autenticador já confirmado, se houver. */
export async function verifiedTotpId(): Promise<string | null> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  return data.totp[0]?.id ?? null;
}

/** Começa a ativação: devolve o QR (imagem SVG em data URL) e o segredo para digitar à mão. */
export async function startTotpEnroll(): Promise<{ factorId: string; qr: string; secret: string }> {
  // Uma ativação abandonada fica como "não verificada" e impede outra: descarta antes.
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) {
    if (f.factor_type === "totp" && f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "App autenticador" });
  if (error) throw error;
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirma um código de 6 dígitos (ativação ou login). A sessão sobe para aal2. */
export async function verifyTotp(factorId: string, code: string): Promise<boolean> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\D/g, "") });
  return !error;
}

export async function removeTotp(factorId: string): Promise<boolean> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  return !error;
}
