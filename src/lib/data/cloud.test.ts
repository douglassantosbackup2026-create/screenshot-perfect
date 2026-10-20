import { beforeEach, describe, expect, it, vi } from "vitest";

// Supabase falso: guarda cada chamada e responde com as tabelas de `db`.
type Call = { kind: "insert" | "update" | "delete" | "rpc"; table: string; payload?: unknown; where?: Record<string, unknown> };
const calls: Call[] = [];
const db: Record<string, Record<string, unknown>[]> = {};
const rpcResult: Record<string, unknown> = {};

function builder(table: string) {
  let op: Call | null = null;
  const where: Record<string, unknown> = {};
  let single = false;
  const b = {
    select: () => b,
    order: () => b,
    eq: (col: string, v: unknown) => ((where[col] = v), b),
    match: (m: Record<string, unknown>) => (Object.assign(where, m), b),
    maybeSingle: () => ((single = true), b),
    single: () => ((single = true), b),
    insert: (payload: unknown) => ((op = { kind: "insert", table, payload }), b),
    update: (payload: unknown) => ((op = { kind: "update", table, payload }), b),
    delete: () => ((op = { kind: "delete", table }), b),
    then(resolve: (v: { data: unknown; error: null }) => void) {
      if (op) {
        calls.push({ ...op, where: { ...where } });
        // Como um banco: o que entra fica para a próxima leitura.
        if (op.kind === "insert") (db[table] ??= []).push(...([] as Record<string, unknown>[]).concat(op.payload as Record<string, unknown>));
        const data = op.kind === "insert" && table === "retirement_plans" ? { id: "plan-1" } : null;
        return resolve({ data, error: null });
      }
      const all = db[table] ?? [];
      const filtered = all.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
      resolve({ data: single ? (filtered[0] ?? null) : filtered, error: null });
    },
  };
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => builder(table),
    rpc: (fn: string, params?: unknown) => {
      calls.push({ kind: "rpc", table: fn, payload: params });
      return Promise.resolve({ data: rpcResult[fn] ?? null, error: null });
    },
    auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  },
}));
vi.mock("sonner", () => ({ toast: Object.assign(() => {}, { error: () => {}, success: () => {} }) }));

const USER = "11111111-1111-4111-8111-111111111111";
const ACC = "22222222-2222-4222-8222-222222222222";
const CAT = "33333333-3333-4333-8333-333333333333";

async function fresh() {
  vi.resetModules();
  calls.length = 0;
  for (const k of Object.keys(db)) delete db[k];
  db["profiles"] = [{ id: USER, display_name: "Bia", onboarding_completed_at: "2026-10-01T00:00:00Z", reminder_day: 5, missing_fields: [] }];
  db["categories"] = [{ id: CAT, name: "Mercado", kind: "despesa" }];
  db["accounts"] = [{ id: ACC, name: "Conta", kind: "corrente", opening_balance: 10000, created_at: "2026-10-01T00:00:00Z" }];
  const cloud = await import("./cloud");
  const store = await import("./demo-store");
  await cloud.startCloud(USER);
  return { cloud, store };
}
/** Espera a fila de gravação esvaziar. */
const settle = () => new Promise((r) => setTimeout(r, 20));
const writes = () => calls.filter((c) => c.kind !== "rpc" || !["materialize_recurring", "get_lesson_questions"].includes(c.table));

beforeEach(() => window.localStorage.clear());

describe("modo nuvem", () => {
  it("carrega a conta do banco e não grava nada no aparelho", async () => {
    const { store } = await fresh();
    const s = store.getState();
    expect(s.profile.displayName).toBe("Bia");
    expect(s.accounts.map((a) => a.id)).toEqual([ACC]);
    expect(s.categories.map((c) => c.id)).toEqual([CAT]);
    expect(store.currentBackend()).toBe("cloud");
    expect(window.localStorage.getItem("pi_demo_state_v1")).toBeNull();
  });

  it("conta sem categorias recebe as padrão do banco", async () => {
    vi.resetModules();
    calls.length = 0;
    db["categories"] = [];
    db["profiles"] = [{ id: USER, display_name: "Bia", onboarding_completed_at: "2026-10-01T00:00:00Z" }];
    const cloud = await import("./cloud");
    await cloud.startCloud(USER);
    expect(calls.some((c) => c.kind === "rpc" && c.table === "seed_default_categories")).toBe(true);
  });

  it("lançamento vai direto para a tabela, com o mesmo id e valores em centavos", async () => {
    const { store } = await fresh();
    store.demo.addTransaction({ accountId: ACC, date: "2026-10-10", amount: -4590, payee: "Padaria", categoryId: CAT });
    await settle();
    const ins = writes().find((c) => c.kind === "insert" && c.table === "transactions");
    expect(ins?.payload).toEqual([
      expect.objectContaining({ user_id: USER, account_id: ACC, date: "2026-10-10", amount: -4590, payee: "Padaria", category_id: CAT, source: "manual" }),
    ]);
    const id = (ins!.payload as { id: string }[])[0]!.id;
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("editar e excluir lançamento viram update e delete pelo id", async () => {
    const { store } = await fresh();
    store.demo.addTransaction({ accountId: ACC, date: "2026-10-10", amount: -100, payee: "x" });
    const id = store.getState().transactions[0]!.id;
    store.demo.updateTransaction(id, { amount: -200 });
    store.demo.deleteTransaction(id);
    await settle();
    const ops = writes().filter((c) => c.table === "transactions").map((c) => [c.kind, c.where?.["id"]]);
    expect(ops).toEqual([
      ["insert", undefined],
      ["update", id],
      ["delete", id],
    ]);
  });

  it("transferência e aporte usam a função do banco (duas pernas e XP no servidor)", async () => {
    const { store } = await fresh();
    store.demo.saveAccount({ name: "PGBL", kind: "previdencia", openingBalance: 0 });
    await settle();
    const prev = store.getState().accounts.find((a) => a.kind === "previdencia")!.id;
    calls.length = 0;
    store.demo.addTransfer({ fromId: ACC, toId: prev, date: "2026-10-10", amount: 100000, contribution: "previdencia" });
    await settle();
    expect(writes()).toEqual([
      { kind: "rpc", table: "create_transfer", payload: { p_from: ACC, p_to: prev, p_date: "2026-10-10", p_amount: 100000, p_note: null, p_contribution: "previdencia" } },
    ]);
  });

  it("orçamento: distribuir insere, mudar atualiza pelo mês e envelope, zerar apaga", async () => {
    const { store } = await fresh();
    const m = store.getState().budget.assigned;
    expect(m).toEqual({});
    const month = new Date().toISOString().slice(0, 8) + "01";
    store.demo.setAssigned(month, CAT, 50000);
    store.demo.setAssigned(month, CAT, 60000);
    store.demo.setAssigned(month, CAT, 0);
    await settle();
    expect(writes().filter((c) => c.table === "budget_assignments").map((c) => [c.kind, c.where])).toEqual([
      ["insert", {}],
      ["update", { month, envelope: CAT }],
      ["delete", { month, envelope: CAT }],
    ]);
  });

  it("plano novo: cria o plano e registra o evento com o motivo 'created'", async () => {
    const { store } = await fresh();
    store.demo.savePlan(store.inputsFromProfile({ birthYear: 1990, goalRetirementAge: 60, goalIncome: 8000 }), "edit");
    await settle();
    const names = writes().map((c) => `${c.kind}:${c.table}`);
    expect(names).toEqual(expect.arrayContaining(["insert:retirement_plans", "rpc:record_plan_event"]));
    const ev = writes().find((c) => c.table === "record_plan_event")!.payload as Record<string, unknown>;
    expect(ev).toMatchObject({ p_plan: "plan-1", p_reason: "created" });
  });

  it("perfil grava só as colunas que mudaram", async () => {
    const { store } = await fresh();
    store.demo.updateProfile({ hideValues: false, reminderDay: 10 });
    await settle();
    expect(writes()).toEqual([{ kind: "update", table: "profiles", payload: { reminder_day: 10, hide_values: false }, where: { id: USER } }]);
  });

  it("importação manda só o que entrou e o que foi ligado a lançamentos manuais", async () => {
    const { store } = await fresh();
    store.demo.importTransactions(ACC, [{ importedId: "F1", date: "2026-10-03", amount: -45090, payee: "MERCADO", memo: null }]);
    await settle();
    const call = writes().find((c) => c.table === "import_transactions")!;
    expect(call.payload).toEqual({
      p_account: ACC,
      p_fresh: [{ date: "2026-10-03", amount: -45090, payee: "MERCADO", categoryId: "", memo: null, importedId: "F1" }],
      p_matched: [],
    });
  });

  it("sair do modo nuvem volta ao modo demonstração", async () => {
    const { cloud, store } = await fresh();
    cloud.stopCloud();
    expect(store.currentBackend()).toBe("demo");
  });
});
