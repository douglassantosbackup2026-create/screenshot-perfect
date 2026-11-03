// Ações do painel que precisam do servidor: conciliação com o Mercado Pago, estado das integrações, cadastro e exclusão
// de conta a pedido. Cada uma confere o perfil no banco (staff_has) com a sessão de quem chama antes de usar o
// service role, e fica no audit_log.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mpRequest, mpToken } from "@/lib/billing/mercadopago";
import { toCents } from "@/lib/billing/catalog";
import { allow, TOO_MANY } from "@/lib/security/rate-limit.server";
import { reconcile, type ReconcileIssue } from "./reconcile";
import { getRequest } from "@tanstack/react-start/server";
import { passwordProblems } from "@/lib/auth/password";
import { openSubscription } from "@/lib/billing/open-subscription";

const NO_ACCESS = "Seu perfil não tem acesso a esta ação." as const;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const MpSearch = z.object({
  paging: z.object({ total: z.number().int() }),
  results: z.array(
    z.object({
      id: z.number().int(),
      status: z.string(),
      transaction_amount: z.number().nonnegative(),
      payer: z.object({ email: z.string().nullish() }).nullish(),
    }),
  ),
});

/** Compara os pagamentos do Mercado Pago no período com os registrados no app. Até 1.000 pagamentos. */
export const adminReconcile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ from: day, to: day }).parse(d))
  .handler(async ({ data, context }): Promise<{ error: string | null; issues: ReconcileIssue[]; checked: number }> => {
    const { data: ok } = await context.supabase.rpc("staff_has", { p_roles: ["financeiro"] });
    if (ok !== true) return { error: NO_ACCESS, issues: [], checked: 0 };
    if (!(await allow([{ key: `admin:reconcile:${context.userId}`, limit: 20, windowSeconds: 3600 }]))) return { error: TOO_MANY, issues: [], checked: 0 };
    const token = mpToken();
    if (!token) return { error: "O Mercado Pago não está configurado neste ambiente.", issues: [], checked: 0 };

    const mp: { id: string; status: string; cents: number; email: string | null }[] = [];
    const begin = `${data.from}T00:00:00.000-03:00`;
    const end = `${data.to}T23:59:59.999-03:00`;
    for (let offset = 0; offset < 1000; offset += 100) {
      const page = await mpRequest(
        token,
        `/v1/payments/search?range=date_created&begin_date=${encodeURIComponent(begin)}&end_date=${encodeURIComponent(end)}&sort=date_created&criteria=desc&limit=100&offset=${offset}`,
        MpSearch,
      );
      if (!page) return { error: "Não foi possível consultar o Mercado Pago agora. Tente de novo em instantes.", issues: [], checked: 0 };
      for (const p of page.results) mp.push({ id: `mp_${p.id}`, status: p.status, cents: toCents(p.transaction_amount), email: p.payer?.email ?? null });
      if (offset + 100 >= page.paging.total) break;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = `${data.from}T00:00:00-03:00`;
    const to = `${data.to}T23:59:59.999-03:00`;
    const [events, credited] = await Promise.all([
      supabaseAdmin.from("payment_events").select("id, status, amount_cents").gte("at", from).lte("at", to),
      supabaseAdmin.from("payments").select("id, amount_cents").gte("created_at", from).lte("created_at", to),
    ]);
    if (events.error || credited.error) return { error: "Não foi possível ler os pagamentos do app.", issues: [], checked: 0 };
    const creditedIds = new Map(credited.data.map((p) => [p.id, p.amount_cents]));
    const local = new Map<string, { id: string; status: string; cents: number; credited: boolean }>();
    for (const e of events.data) local.set(e.id, { id: e.id, status: e.status, cents: e.amount_cents, credited: creditedIds.has(e.id) });
    for (const [id, cents] of creditedIds) if (!local.has(id)) local.set(id, { id, status: "approved", cents, credited: true });

    await supabaseAdmin.rpc("audit", { p_action: "admin_reconcile", p_details: { admin: context.userId, from: data.from, to: data.to, checked: mp.length } });
    return { error: null, issues: reconcile(mp, [...local.values()]), checked: mp.length };
  });

/** Integrações configuradas neste ambiente: só "sim/não" (nunca o valor da variável). */
export const adminIntegrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ok } = await context.supabase.rpc("staff_has", { p_roles: ["super_admin"] });
    if (ok !== true) return { error: NO_ACCESS, items: [] };
    const set = (k: string) => !!process.env[k];
    return {
      error: null,
      items: [
        { name: "Mercado Pago (cobrança)", ok: set("MERCADO_PAGO_ACCESS_TOKEN") && set("MERCADO_PAGO_WEBHOOK_SECRET") },
        { name: "Supabase (servidor)", ok: set("SUPABASE_SERVICE_ROLE_KEY") },
        { name: "WhatsApp (Meta)", ok: set("WHATSAPP_TOKEN") && set("WHATSAPP_APP_SECRET") },
        { name: "Notificações push (VAPID)", ok: set("VAPID_PRIVATE_KEY") },
        { name: "Open Finance", ok: set("OPEN_FINANCE_PROVIDER") },
        { name: "Lembretes agendados (cron)", ok: set("CRON_SECRET") },
      ],
    };
  });

/**
 * Exclusão de conta a pedido da pessoa (LGPD), feita pela equipe. Só super admin, com o e-mail digitado de novo
 * como confirmação. Mesma limpeza da exclusão pelo próprio app: a conta (e tudo ligado a ela) e o lead do e-mail.
 */
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ userId: z.string().uuid(), confirmEmail: z.string().trim().toLowerCase().email() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc("staff_has", { p_roles: ["super_admin"] });
    if (ok !== true) return { error: NO_ACCESS };
    if (data.userId === context.userId) return { error: "Para excluir a própria conta, use o Perfil." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (error || !u.user) return { error: "Conta não encontrada." };
    if ((u.user.email ?? "").toLowerCase() !== data.confirmEmail) return { error: "O e-mail digitado não confere com a conta." };
    // Assinatura ativa: cancelar antes, para não seguir cobrando de quem não tem mais conta.
    const { data: sub } = await supabaseAdmin.from("subscriptions").select("status").eq("user_id", data.userId).maybeSingle();
    if (sub && (sub.status === "authorized" || sub.status === "paused"))
      return { error: "Esta conta tem assinatura ativa. Cancele a assinatura no Mercado Pago antes de excluir." };
    await supabaseAdmin.rpc("audit", {
      p_action: "admin_user_deleted",
      p_target: data.userId,
      p_details: { admin: context.userId },
      p_severity: "high",
    });
    await supabaseAdmin.from("leads").delete().ilike("email", data.confirmEmail);
    const del = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (del.error) return { error: "Não foi possível excluir agora. Tente de novo." };
    return { error: null };
  });

const STAFF_ROLES = ["super_admin", "financeiro", "marketing", "suporte", "analista"] as const;

export const CreateUserInput = z
  .object({
    name: z.string().trim().min(2, "Informe o nome.").max(120),
    email: z.string().trim().toLowerCase().email("E-mail inválido.").max(254),
    password: z.string().min(8).max(72).refine((p) => passwordProblems(p).length === 0, "Senha fraca: use 8 caracteres com letra e número."),
    staffRole: z.enum(STAFF_ROLES).nullable(),
    courtesyMonths: z.number().int().min(1).max(24).nullable(),
    courtesyReason: z.string().trim().max(200).default(""),
    subscription: z.enum(["mensal", "anual"]).nullable(),
    affiliate: z
      .object({
        code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,20}$/, "Código de afiliado: 4 a 20 letras ou números."),
        mode: z.enum(["primeiro", "meses", "sempre"]),
        bp: z.number().int().min(0).max(10000),
        months: z.number().int().min(1).max(120).nullable(),
      })
      .nullable(),
  })
  .refine((d) => !(d.courtesyMonths && d.subscription), "Escolha cortesia ou link de assinatura, não os dois.");

/**
 * Cadastro feito pela equipe (só super admin): cria a conta já confirmada, com senha temporária que a pessoa troca
 * no primeiro acesso, e aplica as opções escolhidas. A conta é o essencial; uma opção que falha (ex.: código de
 * afiliado em uso) vira aviso em vez de desfazer o cadastro. A senha nunca vai para o log nem para a auditoria.
 */
export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => CreateUserInput.parse(d))
  .handler(async ({ data, context }): Promise<{ error: string | null; userId: string | null; link: string | null; warnings: string[] }> => {
    const fail = (error: string) => ({ error, userId: null, link: null, warnings: [] });
    const { data: ok } = await context.supabase.rpc("staff_has", { p_roles: ["super_admin"] });
    if (ok !== true) return fail("Só o super admin cria contas.");
    if (!(await allow([{ key: `admin:create-user:${context.userId}`, limit: 30, windowSeconds: 3600 }]))) return fail(TOO_MANY);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name, display_name: data.name, must_change_password: true },
    });
    if (created.error || !created.data.user) {
      const msg = created.error?.message.toLowerCase() ?? "";
      return fail(msg.includes("already") || msg.includes("exists") ? "Já existe uma conta com este e-mail." : "Não foi possível criar a conta agora.");
    }
    const userId = created.data.user.id;
    const warnings: string[] = [];
    let link: string | null = null;

    if (data.staffRole) {
      const r = await supabaseAdmin.from("staff_roles").insert({ user_id: userId, role: data.staffRole, granted_by: context.userId });
      if (r.error) warnings.push("O perfil da equipe não foi concedido. Conceda em Segurança.");
    }
    if (data.courtesyMonths) {
      // Pela sessão do admin: vale a checagem de perfil e a auditoria do próprio banco.
      const r = await context.supabase.rpc("admin_grant_courtesy", { p_user: userId, p_months: data.courtesyMonths, p_reason: data.courtesyReason || "cadastro pelo painel" });
      if (r.error) warnings.push("A cortesia não foi aplicada. Aplique pela ficha do usuário.");
    }
    if (data.affiliate) {
      const a = data.affiliate;
      const r = await supabaseAdmin.from("affiliates").insert({
        name: data.name,
        email: data.email,
        status: "aprovado",
        code: a.code,
        commission_mode: a.mode,
        commission_bp: a.bp,
        commission_months: a.mode === "meses" ? (a.months ?? 12) : null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      });
      if (r.error) warnings.push(r.error.code === "23505" ? "Afiliado não criado: código ou e-mail já usado por outro afiliado." : "Afiliado não criado. Cadastre em Afiliados.");
    }
    if (data.subscription) {
      const opened = await openSubscription({
        userId,
        email: data.email,
        plan: "inteligencia",
        period: data.subscription,
        origin: new URL(getRequest().url).origin,
        existing: null,
      });
      if (opened.url) link = opened.url;
      else warnings.push(`Link de assinatura não gerado: ${opened.error}`);
    }

    await supabaseAdmin.rpc("audit", {
      p_action: "admin_user_created",
      p_target: userId,
      p_details: {
        admin: context.userId,
        staff_role: data.staffRole,
        courtesy_months: data.courtesyMonths,
        subscription: data.subscription,
        affiliate: data.affiliate ? data.affiliate.code : null,
        warnings,
      },
      p_severity: "high",
    });
    return { error: null, userId, link, warnings };
  });
