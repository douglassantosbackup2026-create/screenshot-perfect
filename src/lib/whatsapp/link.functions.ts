// Conectar o WhatsApp a partir do Perfil: gera um código curto que a pessoa manda para o número do Mitikos.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Sem 0/O e 1/I/L, que se confundem ao digitar.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 10 * 60 * 1000;

function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Cria o código e devolve o link wa.me com a mensagem pronta. */
export const createWhatsAppLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const number = (process.env["WHATSAPP_DISPLAY_NUMBER"] ?? "").replace(/\D/g, "");
    if (!number) return { error: "O WhatsApp ainda não está configurado." as const, code: null, url: null };
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
    const message = `MITIKOS-${code}`;
    return { error: null, code: message, url: `https://wa.me/${number}?text=${encodeURIComponent(message)}` };
  });
