import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Guarda um e-mail com consentimento (lista de espera, dicas da calculadora). Devolve true se ficou salvo.
 * E-mail já cadastrado (23505, um lead por e-mail) conta como sucesso para quem preenche.
 */
export async function saveLead(email: string, source: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("leads").insert({ email: email.trim(), consent_marketing: true, source });
    if (!error || error.code === "23505") return true;
  } catch {
    /* rede: cai no aviso abaixo */
  }
  toast.error("Não foi possível salvar o e-mail. Confira o endereço e tente de novo.");
  return false;
}
