// Comparações de segredos sem vazar nada pelo tempo de resposta.

/** Compara dois textos em tempo constante (para assinaturas de mesmo tamanho). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * O segredo recebido (cabeçalho, token) é o esperado? Compara os hashes, então nem o tamanho
 * do segredo vaza. Vazio ou ausente nunca confere.
 */
export async function secretMatches(
  received: string | null | undefined,
  expected: string | null | undefined,
): Promise<boolean> {
  if (!received || !expected) return false;
  const [a, b] = await Promise.all([sha256Hex(received), sha256Hex(expected)]);
  return safeEqual(a, b);
}
