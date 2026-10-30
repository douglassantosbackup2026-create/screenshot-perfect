import { createFileRoute } from "@tanstack/react-router";

/**
 * Aviso do agregador de Open Finance: dados novos (sincroniza), erro ou consentimento revogado.
 * Autenticado pelo cabeçalho x-webhook-secret = OPEN_FINANCE_WEBHOOK_SECRET. Sempre responde 200 a avisos
 * válidos, para o agregador não repetir; o que falhar fica para a próxima sincronização.
 */
export const Route = createFileRoute("/api/public/openfinance/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["OPEN_FINANCE_WEBHOOK_SECRET"];
        if (!secret || request.headers.get("x-webhook-secret") !== secret) return new Response("nao autorizado", { status: 401 });
        const { providerFromEnv } = await import("@/lib/openfinance/provider");
        const provider = await providerFromEnv();
        if (!provider) return new Response("desligado", { status: 503 });

        const body: unknown = await request.json().catch(() => null);
        const event = provider.parseWebhook(body);
        if (!event) return new Response("ignorado");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: conn } = await supabaseAdmin
          .from("bank_connections")
          .select("id, user_id, item_id, last_synced_at")
          .eq("provider", provider.name)
          .eq("item_id", event.itemId)
          .maybeSingle();
        if (!conn) return new Response("conexao desconhecida");

        if (event.event === "revogado" || event.event === "erro") {
          await supabaseAdmin.from("bank_connections").update({ status: event.event === "revogado" ? "revogada" : "erro" }).eq("id", conn.id);
          return new Response("ok");
        }
        const { syncConnection } = await import("@/lib/openfinance/sync.server");
        const r = await syncConnection(supabaseAdmin, provider, conn);
        if (r.error) console.error("open finance webhook sync failed", r.error);
        return new Response("ok");
      },
    },
  },
});
