// Conectar e sincronizar bancos pelo Open Finance. Desligado enquanto OPEN_FINANCE_PROVIDER não estiver
// configurado no servidor; hoje só aceita o provedor de teste ("mock").
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { allow, TOO_MANY } from "@/lib/security/rate-limit.server";
import { providerFromEnv } from "./provider";

const OFF = "A conexão com bancos ainda não está disponível." as const;

/**
 * Registra uma conexão autorizada e faz a primeira sincronização. Com um agregador real, `itemId` vem do
 * widget dele depois que a pessoa autoriza no banco; no provedor de teste, qualquer id serve.
 */
export const connectBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ itemId: z.string().min(1).max(128), institution: z.string().max(120).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const provider = await providerFromEnv();
    if (!provider) return { error: OFF, added: 0 };
    if (!(await allow([{ key: `bank-connect:user:${context.userId}`, limit: 10, windowSeconds: 3600 }]))) return { error: TOO_MANY, added: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn, error } = await supabaseAdmin
      .from("bank_connections")
      .insert({ user_id: context.userId, provider: provider.name, item_id: data.itemId, institution: data.institution })
      .select("id, user_id, item_id, last_synced_at")
      .single();
    if (error) return { error: error.code === "23505" ? "Este banco já está conectado." : "Não foi possível conectar agora.", added: 0 };
    const { syncConnection } = await import("./sync.server");
    return syncConnection(supabaseAdmin, provider, conn);
  });

/** Busca os lançamentos novos de uma conexão da própria pessoa. */
export const syncBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ connectionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const provider = await providerFromEnv();
    if (!provider) return { error: OFF, added: 0 };
    if (!(await allow([{ key: `bank-sync:user:${context.userId}`, limit: 30, windowSeconds: 3600 }]))) return { error: TOO_MANY, added: 0 };
    // Lida com o cliente da pessoa: a RLS garante que a conexão é dela.
    const { data: conn, error } = await context.supabase
      .from("bank_connections")
      .select("id, user_id, item_id, last_synced_at, status")
      .eq("id", data.connectionId)
      .maybeSingle();
    if (error || !conn) return { error: "Conexão não encontrada.", added: 0 };
    if (conn.status === "revogada") return { error: "A autorização deste banco acabou. Conecte de novo.", added: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncConnection } = await import("./sync.server");
    return syncConnection(supabaseAdmin, provider, conn);
  });

/** Abre o widget do agregador: devolve o token de conexão (Pluggy) ou "mock" no provedor de teste. */
export const getConnectToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const provider = await providerFromEnv();
    if (!provider) return { error: OFF, provider: null, token: null };
    if (!(await allow([{ key: `bank-token:user:${context.userId}`, limit: 20, windowSeconds: 3600 }]))) return { error: TOO_MANY, provider: null, token: null };
    try {
      return { error: null, provider: provider.name, token: await provider.createConnectToken(context.userId) };
    } catch (e) {
      console.error("open finance connect token failed", e instanceof Error ? e.message : e);
      return { error: "Não foi possível abrir a conexão com o banco agora.", provider: null, token: null };
    }
  });
