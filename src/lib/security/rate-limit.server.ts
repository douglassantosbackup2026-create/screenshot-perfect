// Limite de taxa no servidor: contador por janela fixa no banco (hit_rate_limit), que vale entre
// todas as instâncias do Worker. Só no servidor (usa o service_role).

/** IP de quem chamou (Cloudflare põe cf-connecting-ip). */
export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "desconhecido"
  ).slice(0, 64);
}

/** Aparelho: hash curto do user-agent (não identifica ninguém sozinho, só separa aparelhos de um IP). */
export async function deviceKey(request: Request): Promise<string> {
  const ua = request.headers.get("user-agent") ?? "";
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ua));
  return Array.from(new Uint8Array(d).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

export type Limit = { key: string; limit: number; windowSeconds: number };

/**
 * true = pode seguir. Todos os limites contam a chamada. Se o banco falhar, `failClosed` decide:
 * barrar (tentativas de código, onde errar a favor do atacante é pior) ou deixar passar (o resto).
 */
export async function allow(
  limits: Limit[],
  opts: { failClosed?: boolean } = {},
): Promise<boolean> {
  let results;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    results = await Promise.all(
      limits.map((l) =>
        supabaseAdmin.rpc("hit_rate_limit", {
          p_key: l.key,
          p_limit: l.limit,
          p_window_seconds: l.windowSeconds,
        }),
      ),
    );
  } catch (e) {
    // Sem service role (dev sem segredos) ou rede: mesma regra de falha do banco.
    console.error("rate limit unavailable", e instanceof Error ? e.message : e);
    return !opts.failClosed;
  }
  let ok = true;
  for (const r of results) {
    if (r.error) {
      console.error("rate limit check failed", r.error.message);
      if (opts.failClosed) ok = false;
    } else if (r.data !== true) ok = false;
  }
  return ok;
}

export const TOO_MANY =
  "Muitas tentativas em pouco tempo. Espere alguns minutos e tente de novo." as const;

export function tooManyResponse(): Response {
  return new Response("too many requests", { status: 429, headers: { "retry-after": "60" } });
}
