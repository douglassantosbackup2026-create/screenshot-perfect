import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Banco falso: uma linha de user_state por pessoa, com o mesmo filtro por updated_at do PostgREST.
type Row = { user_id: string; data: unknown; updated_at: string };
const db = { rows: new Map<string, Row>(), fail: false, writes: 0 };
let clock = 0;
const stamp = () => new Date(Date.UTC(2026, 0, 1, 0, 0, clock++)).toISOString();

function query(table: string) {
  const filters: Record<string, string> = {};
  let op: "select" | "update" | "insert" = "select";
  let payload: Partial<Row> = {};
  const matches = () => [...db.rows.values()].filter((r) => Object.entries(filters).every(([k, v]) => r[k as keyof Row] === v));
  const run = () => {
    if (db.fail) return { data: null, error: { code: "08006", message: "offline" } };
    if (op === "select") return { data: matches(), error: null };
    db.writes++;
    if (op === "insert") {
      if (db.rows.has(payload.user_id!)) return { data: null, error: { code: "23505", message: "duplicate" } };
      const row = { ...(payload as Row), updated_at: stamp() };
      db.rows.set(row.user_id, row);
      return { data: [row], error: null };
    }
    const hit = matches();
    for (const r of hit) Object.assign(r, payload, { updated_at: stamp() });
    return { data: hit, error: null };
  };
  const q = {
    select: () => q,
    eq: (k: string, v: string) => ((filters[k] = v), q),
    update: (p: Partial<Row>) => ((op = "update"), (payload = p), q),
    insert: (p: Partial<Row>) => ((op = "insert"), (payload = p), q),
    maybeSingle: async () => {
      const r = run();
      return { data: r.data?.[0] ?? null, error: r.error };
    },
    then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
  };
  expect(table).toBe("user_state");
  return q;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: query } }));

async function freshStore() {
  vi.resetModules();
  return import("./demo-store");
}
const row = (user = "u1") => db.rows.get(user)!;
const name = (user = "u1") => (row(user).data as { profile: { displayName: string } }).profile.displayName;

beforeEach(() => {
  window.localStorage.clear();
  db.rows.clear();
  db.fail = false;
  db.writes = 0;
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("sincronização com o banco", () => {
  it("cria a linha da pessoa nova e grava as mudanças", async () => {
    const store = await freshStore();
    await store.attachUser("u1");
    expect(db.rows.has("u1")).toBe(true);
    store.demo.updateProfile({ displayName: "Bia" });
    expect(await store.flushSave()).toBe(true);
    expect(name()).toBe("Bia");
  });

  it("outra aba mudou o mesmo campo antes: fica o do banco, com aviso, e o resto desta aba é gravado", async () => {
    const store = await freshStore();
    await store.attachUser("u1");
    const other = structuredClone(row().data) as { profile: { displayName: string } };
    other.profile.displayName = "Outra aba";
    Object.assign(row(), { data: other, updated_at: stamp() });

    store.demo.updateProfile({ displayName: "Esta aba", reminderDay: 12 });
    expect(await store.flushSave()).toBe(true);
    expect(name()).toBe("Outra aba");
    expect((row().data as { profile: { reminderDay: number } }).profile.reminderDay).toBe(12);
    expect(store.demo.exportData().profile.displayName).toBe("Outra aba");
  });

  it("lançamento feito aqui e outro feito por fora na mesma versão: os dois ficam", async () => {
    const store = await freshStore();
    await store.attachUser("u1");
    store.demo.saveAccount({ name: "Conta", kind: "corrente", openingBalance: 0 });
    expect(await store.flushSave()).toBe(true);
    const acc = store.demo.exportData().accounts[0]!.id;
    const other = structuredClone(row().data) as { transactions: unknown[] };
    other.transactions.push({ id: "whats-1", accountId: acc, date: "2026-10-30", amount: -3000, payee: "Farmácia", categoryId: null, note: null, transferId: null, importedId: null, source: "manual", recurringId: null, occurrenceDate: null, contributionId: null, createdAt: "2026-10-30T12:00:00Z" });
    Object.assign(row(), { data: other, updated_at: stamp() });

    store.demo.addTransaction({ accountId: acc, date: "2026-10-30", amount: -5000, payee: "Mercado" });
    expect(await store.flushSave()).toBe(true);
    const saved = (row().data as { transactions: { id: string; payee: string }[] }).transactions.map((t) => t.payee);
    expect(saved).toContain("Farmácia");
    expect(saved).toContain("Mercado");
  });

  it("sem internet guarda uma cópia local e a recupera ao entrar de novo", async () => {
    let store = await freshStore();
    await store.attachUser("u1");
    db.fail = true;
    store.demo.updateProfile({ displayName: "Offline" });
    expect(await store.flushSave()).toBe(false);
    expect(window.localStorage.getItem("pi_pending_cloud")).toContain("Offline");

    db.fail = false;
    store = await freshStore();
    await store.attachUser("u1");
    await vi.runAllTimersAsync();
    expect(name()).toBe("Offline");
    expect(window.localStorage.getItem("pi_pending_cloud")).toBeNull();
  });

  it("abre sem internet com a última cópia do banco e grava quando a conexão volta", async () => {
    let store = await freshStore();
    await store.attachUser("u1");
    store.demo.updateProfile({ displayName: "Antes" });
    expect(await store.flushSave()).toBe(true);

    db.fail = true;
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    store = await freshStore();
    const s = await store.attachUser("u1");
    expect(s.profile.displayName).toBe("Antes");
    store.demo.updateProfile({ displayName: "Sem internet" });
    expect(await store.flushSave()).toBe(false);
    expect(row().data).toMatchObject({ profile: { displayName: "Antes" } });

    db.fail = false;
    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    await vi.runAllTimersAsync();
    expect(name()).toBe("Sem internet");
    online.mockRestore();
  });

  it("sem internet e sem nada guardado neste aparelho, não abre", async () => {
    db.fail = true;
    const store = await freshStore();
    await expect(store.attachUser("u1")).rejects.toThrow("Confira a internet");
  });

  it("ao sair, nada mais é gravado e a cópia local some", async () => {
    const store = await freshStore();
    await store.attachUser("u1");
    const before = db.writes;
    store.demo.updateProfile({ displayName: "Depois de sair" });
    store.detachUser();
    await vi.runAllTimersAsync();
    expect(db.writes).toBe(before);
    expect(window.localStorage.getItem("pi_pending_cloud")).toBeNull();
  });

  it("stopSync grava o que falta e depois para (exclusão de conta)", async () => {
    const store = await freshStore();
    await store.attachUser("u1");
    store.demo.updateProfile({ displayName: "Última" });
    expect(await store.stopSync()).toBe(true);
    expect(name()).toBe("Última");
    db.rows.delete("u1");
    store.demo.updateProfile({ displayName: "Não pode voltar" });
    await vi.runAllTimersAsync();
    expect(db.rows.has("u1")).toBe(false);
  });
});

describe("falhas inesperadas ao salvar", () => {
  it("uma exceção vira 'não salvo' com nova tentativa, sem rejeição solta", async () => {
    const store = await freshStore();
    await store.attachUser("u1");
    const original = db.rows;
    // Simula um erro lançado (não um { error } do Supabase) durante a gravação.
    db.rows = new Proxy(original, {
      get(target, prop, receiver) {
        if (prop === "values") throw new Error("explodiu");
        const v = Reflect.get(target, prop, receiver);
        return typeof v === "function" ? v.bind(target) : v;
      },
    });
    store.demo.updateProfile({ displayName: "Depois do erro" });
    expect(await store.flushSave()).toBe(false);
    db.rows = original;
    await vi.runAllTimersAsync();
    expect(name()).toBe("Depois do erro");
  });
});

describe("mudança feita por fora (WhatsApp, outro aparelho)", () => {
  it("ao voltar para a aba, carrega a versão nova do banco", async () => {
    const store = await freshStore();
    await store.attachUser("u1");
    await store.flushSave();
    // O servidor (webhook do WhatsApp) grava direto no banco.
    const other = structuredClone(row().data) as { profile: { displayName: string } };
    other.profile.displayName = "Pelo WhatsApp";
    Object.assign(row(), { data: other, updated_at: stamp() });

    expect(await store.refreshFromCloud(Date.now() + 60_000)).toBe(true);
    expect(store.demo.exportData().profile.displayName).toBe("Pelo WhatsApp");
    // Sem mudança nova, não recarrega.
    expect(await store.refreshFromCloud(Date.now() + 120_000)).toBe(false);
  });

  it("com alteração desta aba esperando para gravar, não sobrescreve", async () => {
    const store = await freshStore();
    await store.attachUser("u1");
    Object.assign(row(), { updated_at: stamp() });
    store.demo.updateProfile({ displayName: "Desta aba" });
    expect(await store.refreshFromCloud(Date.now() + 60_000)).toBe(false);
    expect(store.demo.exportData().profile.displayName).toBe("Desta aba");
  });
});
