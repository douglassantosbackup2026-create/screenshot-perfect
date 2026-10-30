import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { currentUtm, track } from "@/lib/analytics/analytics";

/**
 * Guarda um e-mail com consentimento (lista de espera, dicas da calculadora). Devolve true se ficou salvo.
 * E-mail já cadastrado (23505, um lead por e-mail) conta como sucesso para quem preenche.
 * Vão junto as UTMs da visita e, da calculadora, os números simulados (para a mensagem de boas-vindas).
 */
export async function saveLead(email: string, source: string, simulation: Record<string, number | null> | null = null): Promise<boolean> {
  const utm = currentUtm();
  try {
    const { error } = await supabase.from("leads").insert({
      email: email.trim(),
      consent_marketing: true,
      source,
      simulation: simulation as Json,
      utm_source: utm.source ?? null,
      utm_medium: utm.medium ?? null,
      utm_campaign: utm.campaign ?? null,
    });
    if (!error || error.code === "23505") {
      track("lead_saved", { source });
      return true;
    }
  } catch {
    /* rede: cai no aviso abaixo */
  }
  toast.error("Não foi possível salvar o e-mail. Confira o endereço e tente de novo.");
  return false;
}
