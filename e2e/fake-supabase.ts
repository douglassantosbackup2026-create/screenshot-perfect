// Supabase falso para os testes E2E: uma sessão fixa, a tabela user_state e a assinatura em memória.
import type { Page, Route } from "@playwright/test";

const REF = "nzhzmuhjdqcdjoltrsik";
export const USER = { id: "00000000-0000-4000-8000-0000000000e2", email: "e2e@exemplo.com", aud: "authenticated", role: "authenticated" };

export type Entitlement = { plan: string; valid_until: string };
export type FakeDb = {
  row: { user_id: string; data: unknown; updated_at: string } | null;
  writes: number;
  admin: boolean;
  /** Assinatura em vigor; null = sem assinatura (não existe plano grátis). */
  entitlement: Entitlement | null;
};

/** Assinatura válida até bem depois dos testes. */
export const ACTIVE: Entitlement = { plan: "inteligencia", valid_until: "2099-01-01T00:00:00Z" };

let tick = 0;
const stamp = () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString();
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Entra como USER, com `data` já salvo no banco (ou sem nada, se null). Por padrão, com assinatura ativa. */
export async function signIn(
  page: Page,
  data: unknown | null,
  opts: { admin?: boolean; entitlement?: Entitlement | null } = {},
): Promise<FakeDb> {
  const db: FakeDb = {
    row: data ? { user_id: USER.id, data, updated_at: stamp() } : null,
    writes: 0,
    admin: !!opts.admin,
    entitlement: opts.entitlement === undefined ? ACTIVE : opts.entitlement,
  };
  const session = {
    access_token: "e2e-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "e2e-refresh",
    user: USER,
  };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [`sb-${REF}-auth-token`, JSON.stringify(session)]);

  await page.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    if (path === "/auth/v1/user") return json(route, USER);
    if (path === "/auth/v1/logout") return route.fulfill({ status: 204 });
    if (path === "/rest/v1/rpc/has_role") return json(route, db.admin);
    if (path === "/rest/v1/entitlements" || path === "/rest/v1/subscriptions") {
      const row = path === "/rest/v1/entitlements" ? db.entitlement : null;
      // maybeSingle pede um objeto; sem linha, o PostgREST responde 406 e o cliente devolve null.
      if (req.headers()["accept"]?.includes("vnd.pgrst.object")) {
        return row ? json(route, row) : json(route, { code: "PGRST116", details: "The result contains 0 rows", message: "JSON object requested, multiple (or no) rows returned" }, 406);
      }
      return json(route, row ? [row] : []);
    }
    if (path === "/rest/v1/user_state") {
      const method = req.method();
      if (method === "GET") return json(route, db.row ? [db.row] : []);
      const body = req.postDataJSON() as { data: unknown };
      db.writes++;
      if (method === "POST") {
        if (db.row) return json(route, { code: "23505", message: "duplicate key" }, 409);
        db.row = { user_id: USER.id, data: body.data, updated_at: stamp() };
        return json(route, [db.row], 201);
      }
      if (method === "PATCH") {
        const expected = url.searchParams.get("updated_at")?.replace(/^eq\./, "");
        if (!db.row || db.row.updated_at !== expected) return json(route, []);
        db.row = { ...db.row, data: body.data, updated_at: stamp() };
        return json(route, [db.row]);
      }
    }
    return json(route, { message: `não simulado: ${req.method()} ${path}` }, 404);
  });
  return db;
}

export const profileOf = (db: FakeDb) => (db.row?.data as { profile: { displayName: string } } | undefined)?.profile;
export const transactionsOf = (db: FakeDb) => (db.row?.data as { transactions: { payee: string; amount: number }[] }).transactions;
