// Verificação da assinatura x-signature do webhook do Mercado Pago (HMAC-SHA256).
// Manifesto oficial: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
export function parseSignatureHeader(header: string | null): { ts: string; v1: string } | null {
  if (!header) return null;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const [k, ...v] = kv.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  return parts.ts && parts.v1 ? { ts: parts.ts, v1: parts.v1 } : null;
}

export function buildManifest(dataId: string | null, requestId: string | null, ts: string): string {
  let m = "";
  if (dataId) m += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`;
  if (requestId) m += `request-id:${requestId};`;
  return m + `ts:${ts};`;
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function verifyMercadoPagoSignature(opts: {
  secret: string;
  header: string | null;
  requestId: string | null;
  dataId: string | null;
}): Promise<boolean> {
  const parsed = parseSignatureHeader(opts.header);
  if (!parsed) return false;
  const expected = await hmacHex(opts.secret, buildManifest(opts.dataId, opts.requestId, parsed.ts));
  return safeEqual(expected, parsed.v1.toLowerCase());
}
