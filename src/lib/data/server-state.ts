// Mudar o estado salvo de uma pessoa (user_state) pelo servidor: WhatsApp, sincronização do banco.
// Só no servidor (recebe o cliente com service_role). A mudança é uma função pura do demo-store.
import { parseStoredState, type DemoState } from "@/lib/data/demo-store";

export type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const SAVE_ATTEMPTS = 3;

export async function readState(db: Admin, userId: string): Promise<{ state: DemoState; version: string } | null> {
  const { data, error } = await db.from("user_state").select("data, updated_at").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(`user_state: ${error.message}`);
  return data ? { state: parseStoredState(data.data), version: data.updated_at } : null;
}

export type Updated<T> = { ok: true; result: T; state: DemoState } | { ok: false; message: string };

/**
 * Aplica `change` numa cópia do estado salvo e grava só se ninguém gravou no meio (mesma conferência de
 * updated_at do app). Se o app gravou antes, lê de novo e reaplica. Erro de regra (ex.: conta removida) volta como mensagem.
 */
export async function updateState<T>(
  db: Admin,
  userId: string,
  change: (draft: DemoState) => T,
  busyMessage = "Seus dados estavam sendo salvos ao mesmo tempo no app. Tente de novo, por favor.",
): Promise<Updated<T>> {
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
    const loaded = await readState(db, userId);
    if (!loaded) return { ok: false, message: "Não encontrei seus dados. Abra o app uma vez e tente de novo." };
    const draft = structuredClone(loaded.state);
    let result: T;
    try {
      result = change(draft);
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Não foi possível fazer isso agora." };
    }
    const { data, error } = await db
      .from("user_state")
      .update({ data: draft as never, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("updated_at", loaded.version)
      .select("updated_at");
    if (error) throw new Error(`user_state update: ${error.message}`);
    if (data.length) return { ok: true, result, state: draft };
  }
  return { ok: false, message: busyMessage };
}
