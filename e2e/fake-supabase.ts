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
  /** A consulta da assinatura falha (banco fora do ar, requisição bloqueada). */
  entitlementDown: boolean;
  /** Perfis da equipe (painel administrativo); o admin vale como super_admin. */
  staff: string[];
  /** Chamados de atendimento em memória (Perfil → Fale conosco e Painel → Atendimento). */
  tickets: { id: string; kind: string; subject: string; status: string; updated_at: string; last_reply_by: string; email: string }[];
  messages: { ticket_id: string; author: "usuario" | "equipe"; body: string; at: string }[];
};

/** Respostas prontas das funções do painel (números de exemplo, só para as telas abrirem). */
const today = () => new Date().toISOString().slice(0, 10);
const ADMIN_RPC: Record<string, (db: FakeDb) => unknown> = {
  admin_overview: () => ({
    visits: 1200, visits_prev: 1000, sim_started: 300, sim_completed: 210, sim_completed_prev: 180, unique_visitors: 400, sessions: 520,
    leads: 40, leads_prev: 35, signups: 25, signups_prev: 20, users_total: 310, active_subscribers: 120, courtesy_active: 4, mrr_cents: 478800,
    new_subscriptions: 12, new_subscriptions_prev: 9, cancellations: 2, revenue_cents: 51870, payments_refused: 1, active_7d: 80, active_30d: 150,
    incidents_open: 1, tickets_open: 2, tickets_waiting_24h: 1,
    funnel: { sim_completed: 210, leads: 40, signups: 25, subscriptions: 12 },
    series: [{ day: today(), visits: 40, sims: 7, signups: 1, leads: 2 }],
  }),
  admin_billing: () => ({
    by_plan: [{ plan: "inteligencia", period: "mensal", status: "authorized", n: 100 }], active_subscribers: 120, courtesy_active: 4, registered_without_subscription: 190,
    mrr_cents: 478800, revenue_cents: 51870, payments_by_status: { approved: 13, rejected: 1 }, renewals: 10, first_payments: 3, cancellations: 2, active_at_start: 110,
    recent_payments: [{ id: "mp_1", email: "cliente@exemplo.com", status: "approved", amount_cents: 3990, plan: "inteligencia", period: "mensal", at: new Date().toISOString() }],
  }),
  admin_feature_usage: () => ({ people: 300, active_7d: 80, active_30d: 150, inactive_30d: null, features: { plano: 200, lancamentos: 150, orcamento: null }, events_30d: { plano: 60 } }),
  admin_simulations: () => ({ series: [{ day: today(), started: 10, completed: 7 }], age_bands: { "30–39": 12 }, income_bands: {}, monthly_bands: {}, by_source: { "(direto)": 9 }, by_page: { "/": 9 } }),
  admin_marketing: () => ({ campaigns: [{ source: "instagram", campaign: "lancamento", visitors: 50, simulations: 20, leads: 5, signups: 3, checkouts: 2, subscriptions: 1 }], leads_by_source: { instagram: 5 }, events: { landing_view: 50 }, consent: { aceito: 30, recusado: 10 } }),
  admin_incidents: () => [{ id: "i1", source: "cliente", level: "erro", message: "Falhou ao abrir", path: "/plano", count: 3, first_at: new Date().toISOString(), last_at: new Date().toISOString(), status: "aberto", resolved_at: null }],
  admin_leads: () => [{ id: "l1", email: "lead@exemplo.com", source: "calculadora", created_at: new Date().toISOString(), utm_source: null, utm_campaign: null, notes: "", owner_email: null, status: "novo" }],
  admin_staff_list: () => [{ user_id: USER.id, email: USER.email, roles: ["super_admin"], legacy_admin: true, mfa: false, last_sign_in_at: null }],
  admin_audit_log: () => [{ id: 1, at: new Date().toISOString(), actor_email: USER.email, action: "admin_user_card", target: null, severity: "info", details: {} }],
  admin_settings: () => ({ billing_enforced: true, updated_at: new Date().toISOString() }),
  admin_list_notices: () => [],
  admin_list_affiliates: () => [],
  admin_list_coupons: () => [],
  admin_affiliate_commissions: () => [],
  admin_funnel: () => [],
  admin_find_users: () => [],
  admin_tickets: (db) => db.tickets.map((t) => ({ ...t, name: "", assignee: null, assignee_email: null, created_at: t.updated_at, has_account: true, messages: db.messages.filter((m) => m.ticket_id === t.id) })),
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
  opts: { admin?: boolean; entitlement?: Entitlement | null; staff?: string[]; userMetadata?: Record<string, unknown> } = {},
): Promise<FakeDb> {
  const db: FakeDb = {
    row: data ? { user_id: USER.id, data, updated_at: stamp() } : null,
    writes: 0,
    admin: !!opts.admin,
    entitlement: opts.entitlement === undefined ? ACTIVE : opts.entitlement,
    entitlementDown: false,
    staff: opts.staff ?? [],
    tickets: [],
    messages: [],
  };
  const user = { ...USER, user_metadata: opts.userMetadata ?? {} };
  const session = {
    access_token: "e2e-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "e2e-refresh",
    user,
  };
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [`sb-${REF}-auth-token`, JSON.stringify(session)]);

  await page.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    if (path === "/auth/v1/user") return json(route, user);
    if (path === "/auth/v1/logout") return route.fulfill({ status: 204 });
    if (path === "/rest/v1/rpc/is_admin") return json(route, db.admin);
    if (path === "/rest/v1/rpc/has_admin_role") return json(route, db.admin);
    if (path === "/rest/v1/rpc/my_staff_status") return json(route, { roles: db.admin ? ["super_admin"] : db.staff, mfa_needed: false });
    if (path === "/rest/v1/rpc/staff_has") return json(route, db.admin || db.staff.length > 0);
    const rpc = path.startsWith("/rest/v1/rpc/") ? path.slice("/rest/v1/rpc/".length) : null;
    if (rpc && ADMIN_RPC[rpc]) {
      if (!db.admin && !db.staff.length) return json(route, { code: "42501", message: "sem acesso" }, 403);
      return json(route, ADMIN_RPC[rpc]!(db));
    }
    if (rpc === "open_ticket") {
      const b = req.postDataJSON() as { p_kind: string; p_subject: string; p_body: string };
      const id = `t${db.tickets.length + 1}`;
      db.tickets.unshift({ id, kind: b.p_kind, subject: b.p_subject, status: "aberto", updated_at: stamp(), last_reply_by: "usuario", email: USER.email });
      db.messages.push({ ticket_id: id, author: "usuario", body: b.p_body, at: stamp() });
      return json(route, id);
    }
    if (rpc === "admin_ticket_reply") {
      const b = req.postDataJSON() as { p_ticket: string; p_body: string };
      db.messages.push({ ticket_id: b.p_ticket, author: "equipe", body: b.p_body, at: stamp() });
      const t = db.tickets.find((x) => x.id === b.p_ticket);
      if (t) Object.assign(t, { status: "em_andamento", last_reply_by: "equipe", updated_at: stamp() });
      return route.fulfill({ status: 204 });
    }
    if (rpc === "count_anonymous" || rpc === "track_event") return route.fulfill({ status: 204 });
    if (path === "/rest/v1/support_tickets") return json(route, db.tickets);
    if (path === "/rest/v1/support_messages") return json(route, db.messages);
    if (path === "/rest/v1/site_notices") return json(route, []);
    if (path === "/rest/v1/calc_settings") {
      const row = { return_conservador: 0.02, return_central: 0.04, return_otimista: 0.06, inflation: 0.04, horizon: 95, costs: 0, updated_at: new Date().toISOString() };
      return req.headers()["accept"]?.includes("vnd.pgrst.object") ? json(route, row) : json(route, [row]);
    }
    if (path === "/rest/v1/entitlements" || path === "/rest/v1/subscriptions") {
      if (path === "/rest/v1/entitlements" && db.entitlementDown) return json(route, { message: "fora do ar" }, 503);
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
