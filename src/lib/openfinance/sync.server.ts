// Traz os lançamentos de uma conexão para o estado da pessoa: cria as contas na primeira vez e importa
// com as mesmas regras do extrato (dedupe, regras de categoria). Só no servidor.
import { connectedAccountIn, importTransactionsInto } from "@/lib/data/demo-store";
import { updateState, type Admin } from "@/lib/data/server-state";
import { openingBalanceFor, syncSince, toImportedRows } from "@/lib/calc/bankSync";
import { spDate } from "@/lib/gamification/rules";
import type { OpenFinanceProvider } from "./provider";

export type Connection = { id: string; user_id: string; item_id: string; last_synced_at: string | null };

export async function syncConnection(db: Admin, provider: OpenFinanceProvider, conn: Connection, now = new Date()): Promise<{ error: string | null; added: number }> {
  const since = syncSince(spDate(now), conn.last_synced_at);
  let accounts;
  let txs;
  try {
    accounts = await provider.listAccounts(conn.item_id);
    txs = await Promise.all(accounts.map((a) => provider.listTransactions(conn.item_id, a.id, since)));
  } catch (e) {
    console.error("open finance fetch failed", e instanceof Error ? e.message : e);
    await db.from("bank_connections").update({ status: "erro" }).eq("id", conn.id);
    return { error: "O banco não respondeu agora. Tente de novo mais tarde.", added: 0 };
  }

  const r = await updateState(db, conn.user_id, (s) => {
    let added = 0;
    accounts.forEach((pa, i) => {
      const list = txs[i] ?? [];
      const acc = connectedAccountIn(
        s,
        { connectionId: conn.id, externalId: pa.id, name: pa.name, kind: pa.kind, openingBalance: openingBalanceFor(pa.balanceCents, list) },
        now,
      );
      added += importTransactionsInto(s, acc.id, toImportedRows(list), now).added;
    });
    return added;
  });
  if (!r.ok) return { error: r.message, added: 0 };

  await db.from("bank_connections").update({ status: "ativa", last_synced_at: now.toISOString() }).eq("id", conn.id);
  return { error: null, added: r.result };
}
