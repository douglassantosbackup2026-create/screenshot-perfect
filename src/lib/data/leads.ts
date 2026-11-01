import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { currentUtm, track } from "@/lib/analytics/analytics";

/**
 * Guarda um e-mail com consentimento (lista de espera, dicas da calculadora). Devolve true se ficou salvo.
 * Grava pela RPC submit_lead: e-mail já cadastrado dá a mesma resposta (ninguém descobre quais e-mails
 * existem), e cada IP tem limite de envios.
 * Vão junto as UTMs da visita e, da calculadora, os números simulados (para a mensagem de boas-vindas).
 */
export async function saveLead(email: string, source: string, simulation: Record<string, number | null> | null = null): Promise<boolean> {
  const utm = currentUtm();
  try {
    const { error } = await supabase.rpc("submit_lead", {
      p_email: email.trim(),
      p_source: source,
      p_simulation: simulation as Json,
      p_utm_source: utm.source ?? null,
      p_utm_medium: utm.medium ?? null,
      p_utm_campaign: utm.campaign ?? null,
    });
    if (!error) {
      track("lead_saved", { source });
      return true;
    }
  } catch {
    /* rede: cai no aviso abaixo */
  }
  toast.error("Não foi possível salvar o e-mail. Confira o endereço e tente de novo.");
  return false;
}
