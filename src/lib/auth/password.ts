/** Regra de senha: mínimo 8 caracteres, com pelo menos uma letra e um número. */
export function passwordProblems(p: string): string[] {
  const out: string[] = [];
  if (p.length < 8) out.push("Use pelo menos 8 caracteres.");
  if (!/[A-Za-zÀ-ÿ]/.test(p)) out.push("Inclua pelo menos uma letra.");
  if (!/\d/.test(p)) out.push("Inclua pelo menos um número.");
  return out;
}

export const isStrongPassword = (p: string) => passwordProblems(p).length === 0;

/** Só aceita caminhos do próprio app. */
export const safePath = (p?: string, fallback = "/hoje") =>
  p && p.startsWith("/") && !p.startsWith("//") ? p : fallback;

/** Traduz erros comuns do login para português. */
export function authErrorMessage(msg?: string): string {
  const m = (msg ?? "").toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("already registered") || m.includes("already exists")) return "Este e-mail já tem conta. Entre com sua senha.";
  if (m.includes("not confirmed")) return "Seu e-mail ainda não foi confirmado.";
  if (m.includes("weak") || m.includes("password should")) return "Senha fraca. Use 8 caracteres com letra e número.";
  if (m.includes("current password") || m.includes("reauthentication")) return "Senha atual incorreta.";
  if (m.includes("rate limit")) return "Muitas tentativas. Espere um pouco e tente de novo.";
  return "Algo deu errado. Tente de novo.";
}
