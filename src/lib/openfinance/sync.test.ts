import { describe, expect, it } from "vitest";
import { emptyState, type DemoState } from "@/lib/data/demo-store";
import { accountBalances } from "@/lib/calc/ledger";
import { syncConnection } from "./sync.server";
import { mockProvider } from "./mock";
import type { Admin } from "@/lib/data/server-state";

// Banco falso só com o que a sincronização usa: user_state (com a conferência de versão) e bank_connections.
function fakeDb(state: DemoState) {
  const db = { state, version: "v0", connection: { status: "ativa", last_synced_at: null as string | null } };
  let n = 0;
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    let patch: Record<string, unknown> | null = null;
    const q = {
      select: () => q,
      eq: (k: string, v: unknown) => ((filters[k] = v), q),
      update: (p: Record<string, unknown>) => ((patch = p), q),
      maybeSingle: async () => ({ data: { data: structuredClone(db.state), updated_at: db.version }, error: null }),
      then: (res: (v: unknown) => unknown) => {
        if (table === "bank_connections") {
          Object.assign(db.connection, patch);
          return Promise.resolve({ error: null }).then(res);
        }
        if (filters["updated_at"] !== db.version) return Promise.resolve({ data: [], error: null }).then(res);
        db.state = (patch as { data: DemoState }).data;
        db.version = `v${++n}`;
        return Promise.resolve({ data: [{ updated_at: db.version }], error: null }).then(res);
      },
    };
    return q;
  };
  return { db, admin: { from } as unknown as Admin };
}

describe("sincronização do banco (provedor de teste)", () => {
  it("cria as contas com o saldo do banco e não duplica na segunda vez", async () => {
    const { db, admin } = fakeDb(emptyState());
    const conn = { id: "c1", user_id: "u1", item_id: "item1", last_synced_at: null };
    const now = new Date("2026-10-30T15:00:00Z");

    const first = await syncConnection(admin, mockProvider, conn, now);
    expect(first.error).toBeNull();
    expect(first.added).toBeGreaterThan(0);
    expect(db.state.accounts.map((a) => [a.name, a.connectionId, a.externalId])).toEqual([
      ["Banco Teste · Conta corrente", "c1", "cc"],
      ["Banco Teste · Cartão", "c1", "cartao"],
    ]);
    const balances = accountBalances(db.state.accounts, db.state.transactions);
    expect(balances[db.state.accounts[0]!.id]).toBe(352_090);
    expect(balances[db.state.accounts[1]!.id]).toBe(-84_350);
    expect(db.connection.last_synced_at).toBe(now.toISOString());

    const again = await syncConnection(admin, mockProvider, { ...conn, last_synced_at: "2026-10-01T00:00:00Z" }, now);
    expect(again).toEqual({ error: null, added: 0 });
    expect(db.state.accounts).toHaveLength(2);
  });
});
