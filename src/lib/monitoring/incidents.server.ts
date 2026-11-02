// Registra uma falha em `incidents` (monitoramento do painel). Só no servidor; nunca lança: falhar ao
// registrar não pode derrubar quem chamou. O banco corta e-mails e números longos da mensagem.
export type IncidentSource = "cliente" | "salvamento" | "pagamento" | "push" | "whatsapp" | "cron" | "servidor";

export async function reportIncident(source: IncidentSource, message: string, opts: { level?: "aviso" | "erro" | "critico"; path?: string } = {}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("report_incident", {
      p_source: source,
      p_level: opts.level ?? "erro",
      p_message: message.slice(0, 500),
      ...(opts.path ? { p_path: opts.path.slice(0, 200) } : {}),
    });
    if (error) console.error("report_incident failed", error.message);
  } catch (e) {
    console.error("report_incident unavailable", e instanceof Error ? e.message : e);
  }
}
