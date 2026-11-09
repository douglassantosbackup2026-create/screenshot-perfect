// Conectar o WhatsApp a partir do Perfil: gera um código curto que a pessoa manda para o número do Planeja Fácil.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { allow, TOO_MANY } from "@/lib/security/rate-limit.server";

// Sem 0/O e 1/I/L, que se confundem ao digitar.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_LENGTH = 8;

/** 8 letras sorteadas sem viés: bytes acima do último múltiplo de 31 são descartados. */
export function newCode(): string {
  const limit = 256 - (256 % ALPHABET.length);
  let code = "";
  while (code.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < limit && code.length < CODE_LENGTH) code += ALPHABET[b % ALPHABET.length];
    }
  }
  return code;
}

/** Cria o código e devolve o link wa.me com a mensagem pronta. */
export const createWhatsAppLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const number = (process.env["WHATSAPP_DISPLAY_NUMBER"] ?? "").replace(/\D/g, "");
    if (!number) return { error: "O WhatsApp ainda não está configurado." as const, code: null, url: null };
    if (!(await allow([{ key: `wa-code:user:${context.userId}`, limit: 10, windowSeconds: 3600 }]))) return { error: TOO_MANY, code: null, url: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Um código por vez: gerar outro invalida o anterior.
    await supabaseAdmin.from("whatsapp_link_codes").delete().eq("user_id", context.userId);
    const code = newCode();
    const { error } = await supabaseAdmin
      .from("whatsapp_link_codes")
      .insert({ code, user_id: context.userId, expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString() });
    if (error) {
      console.error("whatsapp link code failed", error.message);
      return { error: "Não foi possível gerar o código agora. Tente de novo." as const, code: null, url: null };
    }
    const message = `PLANEJA-${code}`;
    return { error: null, code: message, url: `https://wa.me/${number}?text=${encodeURIComponent(message)}` };
  });
