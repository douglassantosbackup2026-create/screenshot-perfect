// Assinatura do webhook da Meta: X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(corpo cru, app secret).
// O corpo precisa ser o texto exato recebido, antes de qualquer JSON.parse.
import { hmacHex, safeEqual } from "@/lib/billing/signature";

export async function verifyMetaSignature(appSecret: string, header: string | null, rawBody: string): Promise<boolean> {
  const sent = header?.startsWith("sha256=") ? header.slice(7).toLowerCase() : null;
  if (!sent || !/^[0-9a-f]{64}$/.test(sent)) return false;
  return safeEqual(await hmacHex(appSecret, rawBody), sent);
}
