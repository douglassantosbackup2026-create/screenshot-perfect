// Headers de segurança em toda resposta do servidor.
// A CSP completa vai primeiro em modo "Report-Only": o SSR injeta scripts inline, e impor `script-src`
// sem nonce quebraria a hidratação. O que já pode ser imposto sem risco vai na CSP de verdade.

/** Quem pode exibir o app num iframe: o próprio app e o editor do Lovable (preview). */
const FRAME_ANCESTORS = "'self' https://lovable.dev https://*.lovable.dev https://*.lovable.app";

export const ENFORCED_CSP = [`frame-ancestors ${FRAME_ANCESTORS}`, "object-src 'none'", "base-uri 'self'"].join("; ");

export const REPORT_ONLY_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "form-action 'self'",
  `frame-ancestors ${FRAME_ANCESTORS}`,
  "object-src 'none'",
  "base-uri 'self'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": ENFORCED_CSP,
  "Content-Security-Policy-Report-Only": REPORT_ONLY_CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
};

/** Devolve a resposta com os headers de segurança (sem sobrescrever os que a rota já definiu). */
export function withSecurityHeaders(response: Response): Response {
  // Respostas 1xx (upgrade de WebSocket) não podem ser recriadas com `new Response`.
  if (response.status < 200) return response;
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) if (!headers.has(k)) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
