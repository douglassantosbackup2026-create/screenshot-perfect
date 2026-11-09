// @vitest-environment node
// Permissões do banco testadas num Postgres de verdade (PGlite, em WASM): aplica todas as migrations de
// supabase/migrations em ordem e confere RLS, grants e funções como cada papel do Supabase.
// O esquema `auth` é simulado (users, mfa_factors, uid(), jwt()), e as tabelas novas recebem os privilégios
// padrão que o Supabase dá a anon/authenticated (o pior caso: o que proteger, tem de ser pelo RLS/revoke).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

const SUPABASE_BOOTSTRAP = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key,
  email text,
  phone text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  email_confirmed_at timestamptz default now(),
  last_sign_in_at timestamptz
);
create table auth.mfa_factors (id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt()->>'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
grant execute on all functions in schema auth to anon, authenticated, service_role;
-- Função que o Supabase cria em projetos novos (a migration security_hardening revoga o acesso a ela).
create function public.rls_auto_enable() returns void language sql as $$ select $$;
-- A conta do admin real, que a migration 20261024131835 promove (antes de existirem os gatilhos de perfil).
insert into auth.users (id, email) values ('64103b17-e90c-4bb9-a040-57badfe00074', 'admin-real@teste.dev');
`;

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ADMIN = "00000000-0000-4000-8000-0000000000ad";

let db: PGlite;
const applied: string[] = [];

type As = { role: "anon" | "authenticated" | "service_role"; sub?: string; aal?: "aal1" | "aal2" };

/** Roda `fn` como um papel do Supabase, numa transação desfeita no fim (os testes não se afetam). */
async function as<T>(who: As, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  let out: T;
  let failure: unknown;
  try {
    await db.transaction(async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: who.role, sub: who.sub, aal: who.aal ?? "aal1" }),
      ]);
      await tx.exec(`set local role ${who.role}`);
      try {
        out = await fn(tx);
      } catch (e) {
        failure = e;
      }
      await tx.rollback();
    });
  } catch {
    /* o rollback acima encerra a transação */
  }
  if (failure) throw failure;
  return out!;
}

const rows = async (tx: Transaction, sql: string, params: unknown[] = []) => (await tx.query(sql, params)).rows;
const denied = async (p: Promise<unknown>) => {
  await expect(p).rejects.toThrow(/permission denied|row-level security|apenas |sem acesso|42501|violates/i);
};

beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_BOOTSTRAP);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    try {
      await db.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
      applied.push(file);
    } catch (e) {
      throw new Error(`migration ${file} falhou: ${e instanceof Error ? e.message : e}`);
    }
  }
  // Três contas: o gatilho handle_new_user cria perfil, estatísticas e papel 'user'.
  await db.exec(`
    insert into auth.users (id, email) values
      ('${A}', 'a@teste.dev'), ('${B}', 'b@teste.dev'), ('${ADMIN}', 'admin@teste.dev');
    insert into public.user_roles (user_id, role) values ('${ADMIN}', 'admin');
    insert into public.user_state (user_id, data) values ('${A}', '{"x":1}'), ('${B}', '{"x":2}');
  `);
}, 120_000);

describe("migrations", () => {
  it("todas aplicam em ordem num Postgres limpo", () => {
    expect(applied.length).toBe(readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).length);
  });

  it("todas as tabelas de public têm RLS ligado", async () => {
    const off = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`,
    );
    expect(off.rows.map((r) => r.relname)).toEqual([]);
  });

  it("toda função SECURITY DEFINER de public fixa o search_path", async () => {
    const loose = await db.query<{ proname: string }>(
      `select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef
          and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') order by 1`,
    );
    expect(loose.rows.map((r) => r.proname)).toEqual([]);
  });
});

describe("dados de cada pessoa", () => {
  it("A só lê o próprio estado; B fica invisível", async () => {
    const got = await as({ role: "authenticated", sub: A }, (tx) => rows(tx, "select user_id from public.user_state"));
    expect(got).toEqual([{ user_id: A }]);
  });

  it("A não altera nem apaga o estado de B", async () => {
    const changed = await as({ role: "authenticated", sub: A }, async (tx) => {
      const u = await tx.query(`update public.user_state set data = '{"hack":1}' where user_id = $1`, [B]);
      return u.affectedRows;
    });
    expect(changed).toBe(0);
  });

  it("A não cria estado em nome de B", async () => {
    await denied(as({ role: "authenticated", sub: A }, (tx) => tx.query(`insert into public.user_state (user_id, data) values ($1, '{}')`, [B])));
  });

  it("anon não lê dados pessoais", async () => {
    for (const t of ["user_state", "profiles", "payments", "subscriptions", "entitlements", "transactions", "audit_log"]) {
      const r = await as({ role: "anon" }, (tx) => rows(tx, `select * from public.${t}`)).catch(() => []);
      expect(r, t).toEqual([]);
    }
  });

  it("ninguém fora do servidor lê tabelas internas (afiliados, cupons, configurações, analytics)", async () => {
    for (const role of ["anon", "authenticated"] as const)
      for (const t of ["affiliates", "referrals", "affiliate_commissions", "coupons", "coupon_redemptions", "app_settings", "analytics_events", "consent_log"])
        await denied(as({ role, sub: A }, (tx) => tx.query(`select * from public.${t}`)));
  });

  it("A não se promove a admin", async () => {
    await denied(as({ role: "authenticated", sub: A }, (tx) => tx.query(`insert into public.user_roles (user_id, role) values ($1, 'admin')`, [A])));
  });
});

describe("admin", () => {
  const adminRpcs = [
    "select public.admin_list_affiliates(null)",
    "select public.admin_list_coupons()",
    "select public.admin_affiliate_commissions(null)",
    "select public.admin_set_plan_price('inteligencia', 'mensal', 4490)",
  ];

  it("usuário comum é recusado em todas as funções de admin", async () => {
    for (const sql of adminRpcs) await denied(as({ role: "authenticated", sub: A }, (tx) => tx.query(sql)));
  });

  it("anon nem consegue chamar as funções de admin", async () => {
    for (const sql of adminRpcs) await denied(as({ role: "anon" }, (tx) => tx.query(sql)));
  });

  it("admin sem segundo fator entra", async () => {
    const r = await as({ role: "authenticated", sub: ADMIN, aal: "aal1" }, (tx) => rows(tx, "select public.is_admin() as ok"));
    expect(r).toEqual([{ ok: true }]);
  });

  it("admin que ativou o segundo fator precisa dele (aal2) também nas funções de admin", async () => {
    await db.exec(`insert into auth.mfa_factors (user_id, status) values ('${ADMIN}', 'verified')`);
    try {
      await denied(as({ role: "authenticated", sub: ADMIN, aal: "aal1" }, (tx) => tx.query("select public.admin_list_coupons()")));
      const ok = await as({ role: "authenticated", sub: ADMIN, aal: "aal2" }, (tx) => rows(tx, "select public.is_admin() as ok"));
      expect(ok).toEqual([{ ok: true }]);
    } finally {
      await db.exec(`delete from auth.mfa_factors where user_id = '${ADMIN}'`);
    }
  });
});

describe("regras específicas", () => {
  it("preços: todos leem, ninguém além do admin grava", async () => {
    const r = await as({ role: "anon" }, (tx) => rows(tx, "select plan, period, cents from public.plan_prices order by 1, 2"));
    expect(r).toHaveLength(3);
    for (const role of ["anon", "authenticated"] as const)
      await denied(as({ role, sub: A }, (tx) => tx.query("update public.plan_prices set cents = 1")));
    const saved = await as({ role: "authenticated", sub: ADMIN }, async (tx) => {
      await tx.query("select public.admin_set_plan_price('inteligencia', 'mensal', 4490)");
      return rows(tx, "select cents from public.plan_prices where plan = 'inteligencia' and period = 'mensal'");
    });
    expect(saved).toEqual([{ cents: 4490 }]);
  });

  it("WhatsApp: a pessoa muda as preferências, mas não o telefone nem a verificação", async () => {
    await db.exec(`insert into public.whatsapp_links (user_id, phone) values ('${A}', '5511999990000') on conflict do nothing`);
    await denied(as({ role: "authenticated", sub: A }, (tx) => tx.query(`update public.whatsapp_links set phone = '5511888880000'`)));
    await denied(as({ role: "authenticated", sub: A }, (tx) => tx.query(`update public.whatsapp_links set verified_at = now()`)));
    const n = await as({ role: "authenticated", sub: A }, async (tx) => (await tx.query(`update public.whatsapp_links set discreet = true`)).affectedRows);
    expect(n).toBe(1);
  });

  it("pagamento de indicado com cupom: comissão sobre o valor pago e um ciclo de desconto contado", async () => {
    const result = await as({ role: "service_role" }, async (tx) => {
      await tx.exec(`
        insert into public.affiliates (id, name, email, status, code, commission_mode, commission_bp, commission_months)
          values ('11111111-1111-4111-8111-111111111111', 'Afiliada', 'afiliada@teste.dev', 'aprovado', 'AFIL10', 'meses', 2000, 12);
        insert into public.referrals (user_id, affiliate_id, code, source)
          values ('${B}', '11111111-1111-4111-8111-111111111111', 'AFIL10', 'link');
        insert into public.coupons (id, code, kind, value, duration, cycles)
          values ('22222222-2222-4222-8222-222222222222', 'BEMVINDO', 'percent', 2000, 'meses', 2);
        insert into public.subscriptions (user_id, preapproval_id, plan, period, status, coupon_id, amount_cents, full_cents, coupon_cycles)
          values ('${B}', 'pre_b', 'inteligencia', 'mensal', 'authorized', '22222222-2222-4222-8222-222222222222', 3192, 3990, 2);
      `);
      await tx.query("select public.credit_payment('mp_1', $1, 'inteligencia', 'mensal', 3192)", [B]);
      await tx.query("select public.credit_payment('mp_1', $1, 'inteligencia', 'mensal', 3192)", [B]); // repetido: não conta de novo
      await tx.query("select public.credit_payment('mp_2', $1, 'inteligencia', 'mensal', 3192)", [B]);
      return {
        commissions: await rows(tx, "select payment_id, commission_cents from public.affiliate_commissions order by 1"),
        sub: await rows(tx, `select cycles_used from public.subscriptions where user_id = '${B}'`),
        uses: await rows(tx, "select count(*)::int as n from public.coupon_redemptions"),
      };
    });
    expect(result.commissions).toEqual([
      { payment_id: "mp_1", commission_cents: 638 },
      { payment_id: "mp_2", commission_cents: 638 },
    ]);
    expect(result.sub).toEqual([{ cycles_used: 2 }]);
    expect(result.uses).toEqual([{ n: 1 }]);
  });

  it("ninguém usa o próprio código de afiliado", async () => {
    const r = await as({ role: "service_role" }, async (tx) => {
      await tx.exec(`
        insert into public.affiliates (name, email, status, code, commission_months) values ('Ana', 'a@teste.dev', 'aprovado', 'PROPRIO1', 12);
      `);
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: A })]);
      await tx.exec("set local role authenticated");
      return rows(tx, "select public.claim_referral('PROPRIO1', 'cupom') as r");
    });
    expect((r[0] as { r: unknown }).r).toMatchObject({ ok: false, reason: "proprio codigo" });
  });

  it("inscrição pública de afiliado é salva, com comissão padrão de 12 meses", async () => {
    const r = await as({ role: "service_role" }, (tx) =>
      rows(tx, "insert into public.affiliates (name, email) values ('Thais', 't@teste.dev') returning commission_mode, commission_months"),
    );
    expect(r).toEqual([{ commission_mode: "meses", commission_months: 12 }]);
  });

  it("com a cobrança ligada, só quem tem assinatura grava o próprio estado", async () => {
    const blocked = await as({ role: "service_role" }, async (tx) => {
      await tx.exec("update public.app_settings set billing_enforced = true");
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: A })]);
      await tx.exec("set local role authenticated");
      return tx.query(`update public.user_state set data = '{"y":1}' where user_id = $1`, [A]).then(
        () => "gravou",
        (e: Error) => e.message,
      );
    });
    expect(blocked).toMatch(/row-level security|violates/i);
  });
});

const FIN = "00000000-0000-4000-8000-0000000000f1";
const MKT = "00000000-0000-4000-8000-0000000000f2";
const SUP = "00000000-0000-4000-8000-0000000000f3";
const ANA = "00000000-0000-4000-8000-0000000000f4";
const call = (sub: string, sql: string) => as({ role: "authenticated", sub }, (tx) => tx.query(sql));
const allowed = async (sub: string, sql: string) => {
  await expect(call(sub, sql)).resolves.toBeTruthy();
};
const statusOf = async (sub: string, aal: "aal1" | "aal2" = "aal1") => {
  const r = await as({ role: "authenticated", sub, aal }, (tx) => rows(tx, "select public.my_staff_status() as s"));
  return (r[0] as { s: { roles: string[]; mfa_needed: boolean } }).s;
};

describe("painel administrativo: perfis da equipe", () => {
  beforeAll(async () => {
    await db.exec(`
      insert into auth.users (id, email) values
        ('${FIN}', 'fin@teste.dev'), ('${MKT}', 'mkt@teste.dev'), ('${SUP}', 'sup@teste.dev'), ('${ANA}', 'ana@teste.dev');
      insert into public.staff_roles (user_id, role) values
        ('${FIN}', 'financeiro'), ('${MKT}', 'marketing'), ('${SUP}', 'suporte'), ('${ANA}', 'analista');
    `);
  });

  it("cada perfil vê o próprio menu", async () => {
    expect(await statusOf(FIN)).toEqual({ roles: ["financeiro"], mfa_needed: false });
    expect((await statusOf(ADMIN)).roles).toEqual(["super_admin"]);
    expect(await statusOf(A)).toEqual({ roles: [], mfa_needed: false });
  });

  it("financeiro: faturamento e preços sim; leads, atendimento e segurança não", async () => {
    await allowed(FIN, "select public.admin_billing(current_date - 30, current_date)");
    await allowed(FIN, "select public.admin_set_plan_price('inteligencia', 'anual', 39900)");
    await denied(call(FIN, "select public.admin_leads(null, null)"));
    await denied(call(FIN, "select public.admin_tickets(null)"));
    await denied(call(FIN, "select public.admin_staff_list()"));
  });

  it("marketing: leads, simulações e cupons sim; faturamento e preços não", async () => {
    await allowed(MKT, "select public.admin_leads(null, null)");
    await allowed(MKT, "select public.admin_simulations(current_date - 30, current_date)");
    await allowed(MKT, "select public.admin_list_coupons()");
    await denied(call(MKT, "select public.admin_billing(current_date - 30, current_date)"));
    await denied(call(MKT, "select public.admin_set_plan_price('inteligencia', 'mensal', 1)"));
  });

  it("suporte: atendimento, incidentes e ficha sim; leads e resolver incidente não", async () => {
    await allowed(SUP, "select public.admin_tickets(null)");
    await allowed(SUP, "select public.admin_incidents(null)");
    await allowed(SUP, `select public.admin_user_card('${A}')`);
    await denied(call(SUP, "select public.admin_leads(null, null)"));
    await denied(call(SUP, "select public.admin_resolve_incident(gen_random_uuid())"));
  });

  it("analista: lê relatórios agregados, mas não grava nada", async () => {
    await allowed(ANA, "select public.admin_overview(current_date - 30, current_date)");
    await allowed(ANA, "select public.admin_feature_usage()");
    await allowed(ANA, "select public.admin_funnel(current_date - 30, current_date)");
    for (const sql of [
      "select public.admin_set_plan_price('inteligencia', 'mensal', 4490)",
      "select public.admin_save_coupon(null, '{}'::jsonb)",
      "select public.admin_update_lead(gen_random_uuid(), 'contatado', '')",
      "select public.admin_save_notice(null, 'Aviso', null, true, null)",
      "select public.admin_set_calc_settings('{}'::jsonb)",
      "select public.admin_staff_grant('a@teste.dev', 'super_admin')",
    ])
      await denied(call(ANA, sql));
  });

  it("usuário comum não chama nenhuma função nova do painel", async () => {
    for (const sql of [
      "select public.admin_overview(current_date - 7, current_date)",
      "select public.admin_billing(current_date - 7, current_date)",
      "select public.admin_feature_usage()",
      `select public.admin_user_card('${B}')`,
      "select public.admin_audit_log(null, null, 10)",
      "select public.admin_tickets(null)",
    ])
      await denied(call(A, sql));
  });

  it("perfil da equipe com segundo fator ativo precisa dele (aal2)", async () => {
    await db.exec(`insert into auth.mfa_factors (user_id, status) values ('${FIN}', 'verified')`);
    try {
      await denied(as({ role: "authenticated", sub: FIN, aal: "aal1" }, (tx) => tx.query("select public.admin_billing(current_date - 7, current_date)")));
      expect(await statusOf(FIN, "aal1")).toEqual({ roles: [], mfa_needed: true });
      expect((await statusOf(FIN, "aal2")).roles).toEqual(["financeiro"]);
    } finally {
      await db.exec(`delete from auth.mfa_factors where user_id = '${FIN}'`);
    }
  });

  it("super admin concede perfis, mas não tira o próprio super admin", async () => {
    await as({ role: "authenticated", sub: ADMIN }, async (tx) => {
      await tx.query("select public.admin_staff_grant('b@teste.dev', 'analista')");
      expect(JSON.stringify(await rows(tx, "select public.admin_staff_list() as l"))).toContain("b@teste.dev");
    });
    await expect(call(ADMIN, `select public.admin_staff_revoke('${ADMIN}', 'super_admin')`)).rejects.toThrow(/próprio super admin/);
  });
});

describe("painel administrativo: métricas, atendimento e incidentes", () => {
  it("contagem anônima: só chaves da lista, e a tabela não tem coluna de identificador", async () => {
    await as({ role: "anon" }, async (tx) => {
      await tx.query("select public.count_anonymous('visita:/')");
      await tx.query("select public.count_anonymous('simulacao_concluida')");
    });
    await expect(as({ role: "anon" }, (tx) => tx.query("select public.count_anonymous('visita:/perfil?email=x')"))).rejects.toThrow(
      /chave desconhecida/,
    );
    const cols = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'metrics_daily' order by 1",
    );
    expect(cols.rows.map((c) => c.column_name)).toEqual(["day", "key", "n"]);
  });

  it("anon não lê contagens, chamados, incidentes, pagamentos nem a equipe", async () => {
    for (const t of ["metrics_daily", "support_tickets", "support_messages", "incidents", "payment_events", "staff_roles"])
      await denied(as({ role: "anon" }, (tx) => tx.query(`select * from public.${t}`)));
  });

  it("uso das funcionalidades esconde grupos com menos de 5 pessoas", async () => {
    const r = await as({ role: "authenticated", sub: ADMIN }, (tx) => rows(tx, "select public.admin_feature_usage() as u"));
    const u = (r[0] as { u: { people: number | null; features: Record<string, number | null> } }).u;
    // A base de teste tem 2 estados salvos: tudo abaixo de 5 vem nulo.
    expect(u.people).toBeNull();
    expect(Object.values(u.features).every((v) => v === null)).toBe(true);
  });

  it("chamado: a pessoa abre, só ela vê, a equipe responde e a pessoa não muda o status", async () => {
    const ticket = await as({ role: "service_role" }, async (tx) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: A })]);
      await tx.exec("set local role authenticated");
      const r = await rows(tx, "select public.open_ticket('erro', 'Tela travou', 'Ao salvar o plano.') as id");
      const id = (r[0] as { id: string }).id;
      expect(await rows(tx, "select id from public.support_tickets")).toHaveLength(1);
      // B não vê o chamado de A.
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: B })]);
      expect(await rows(tx, "select id from public.support_tickets")).toEqual([]);
      // A equipe responde.
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: ADMIN, aal: "aal1" })]);
      await tx.query("select public.admin_ticket_reply($1, 'Já corrigimos, obrigado!')", [id]);
      // A não muda o status direto.
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ role: "authenticated", sub: A })]);
      const changed = await tx.query("update public.support_tickets set status = 'fechado'").then(
        () => "mudou",
        (e: Error) => e.message,
      );
      expect(changed).toMatch(/permission denied/);
      return id;
    });
    expect(ticket).toBeTruthy();
  });

  it("incidente: mesma falha soma na mesma linha e reabre depois de resolvido, sem guardar e-mail", async () => {
    await as({ role: "service_role" }, async (tx) => {
      await tx.query("select public.report_incident('cliente', 'erro', 'Falhou para maria@exemplo.com no pedido 123456', '/plano')");
      await tx.query("select public.report_incident('cliente', 'erro', 'Falhou para joao@exemplo.com no pedido 999999', '/plano')");
      expect(await rows(tx, "select count, message, status from public.incidents")).toEqual([
        { count: 2, message: "Falhou para <email> no pedido <n>", status: "aberto" },
      ]);
      await tx.exec("update public.incidents set status = 'resolvido', resolved_at = now()");
      await tx.query("select public.report_incident('cliente', 'erro', 'Falhou para x@y.com no pedido 1234', '/plano')");
      expect(await rows(tx, "select status, count from public.incidents")).toEqual([{ status: "aberto", count: 3 }]);
    });
    await denied(call(ADMIN, "select public.report_incident('cliente', 'erro', 'x')"));
  });

  it("visão geral calcula e conta o que foi registrado", async () => {
    await as({ role: "anon" }, (tx) => tx.query("select public.count_anonymous('visita:/calculadora')"));
    await db.exec("insert into public.metrics_daily (day, key, n) values ((now() at time zone 'America/Sao_Paulo')::date, 'visita:/', 3) on conflict (day, key) do update set n = 3");
    const r = await as({ role: "authenticated", sub: ADMIN }, (tx) => rows(tx, "select public.admin_overview(current_date - 6, current_date) as o"));
    const o = (r[0] as { o: Record<string, unknown> }).o;
    expect(Number(o["visits"])).toBe(3);
    expect(o["series"]).toHaveLength(7);
    expect(Number(o["users_total"])).toBeGreaterThanOrEqual(3);
  });

  it("premissas da calculadora: todos leem; super grava só dentro das faixas", async () => {
    const r = await as({ role: "anon" }, (tx) => rows(tx, "select return_central, horizon from public.calc_settings"));
    expect(r).toEqual([{ return_central: "0.04", horizon: 95 }]);
    await expect(
      call(
        ADMIN,
        `select public.admin_set_calc_settings('{"return_conservador":0.02,"return_central":0.5,"return_otimista":0.6,"inflation":0.04,"horizon":95,"costs":0}')`,
      ),
    ).rejects.toThrow(/check/);
  });
});

describe("cadastro pelo painel: acesso de cortesia", () => {
  it("só financeiro e super admin dão cortesia", async () => {
    for (const who of [MKT, ANA, SUP, A]) await denied(call(who, `select public.admin_grant_courtesy('${B}', 3, 'teste')`));
    await allowed(FIN, `select public.admin_grant_courtesy('${B}', 3, 'parceiro')`);
  });

  it("libera o plano, registra quem deu e fora da faixa é recusado", async () => {
    await as({ role: "authenticated", sub: ADMIN }, async (tx) => {
      await tx.query(`select public.admin_grant_courtesy('${A}', 6, 'imprensa')`);
      await tx.exec("set local role service_role"); // só o servidor lê as tabelas internas
      const e = await rows(tx, `select plan, valid_until > now() + interval '5 months' as ok from public.entitlements where user_id = '${A}'`);
      expect(e).toEqual([{ plan: "inteligencia", ok: true }]);
      const g = await rows(tx, `select months, reason, granted_by from public.courtesy_grants where user_id = '${A}'`);
      expect(g).toEqual([{ months: 6, reason: "imprensa", granted_by: ADMIN }]);
    });
    await expect(call(ADMIN, `select public.admin_grant_courtesy('${A}', 0, '')`)).rejects.toThrow(/1 a 24/);
    await expect(call(ADMIN, `select public.admin_grant_courtesy('${A}', 25, '')`)).rejects.toThrow(/1 a 24/);
  });

  it("cortesia não conta como assinante pagante na visão geral nem no faturamento", async () => {
    const r = await as({ role: "authenticated", sub: ADMIN }, async (tx) => {
      // B paga; A só tem cortesia (dados montados como servidor; consultas como admin).
      await tx.exec("set local role service_role");
      await tx.exec(`insert into public.entitlements (user_id, plan, valid_until) values ('${B}', 'inteligencia', now() + interval '20 days')
                     on conflict (user_id) do update set valid_until = excluded.valid_until`);
      await tx.exec(`delete from public.courtesy_grants where user_id = '${B}'`);
      await tx.exec("set local role authenticated");
      await tx.query(`select public.admin_grant_courtesy('${A}', 3, 'teste')`);
      return {
        o: (await rows(tx, "select public.admin_overview(current_date - 6, current_date) as o"))[0] as { o: Record<string, number> },
        b: (await rows(tx, "select public.admin_billing(current_date - 6, current_date) as b"))[0] as { b: Record<string, number> },
      };
    });
    expect(Number(r.o.o["active_subscribers"])).toBe(1);
    expect(Number(r.o.o["courtesy_active"])).toBe(1);
    expect(Number(r.b.b["active_subscribers"])).toBe(1);
    expect(Number(r.b.b["courtesy_active"])).toBe(1);
  });
});
