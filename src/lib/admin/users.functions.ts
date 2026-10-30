// Ações de admin sobre a assinatura de outra conta. Cada uma confere is_admin() com a sessão de quem
// chama antes de usar o service role; sem isso, nada acontece.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mpRequest, mpToken } from "@/lib/billing/mercadopago";
import { decidePreapproval, MpPreapprovalSchema } from "@/lib/billing/webhook";
import { NOT_CONFIGURED, openSubscription, TRY_AGAIN } from "@/lib/billing/open-subscription";

const NOT_ADMIN = "Apenas administradores." as const;

/** Gera um link novo de assinatura para a conta `userId` (cancela um pendente antes). */
export const adminSubscriptionLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ userId: z.string().uuid(), period: z.enum(["mensal", "anual"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("is_admin");
    if (admin !== true) return { error: NOT_ADMIN, url: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: user, error: userError }, { data: existing, error }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(data.userId),
      supabaseAdmin.from("subscriptions").select("preapproval_id, status").eq("user_id", data.userId).maybeSingle(),
    ]);
    if (userError || !user.user) return { error: "Conta não encontrada.", url: null };
    if (error) return { error: TRY_AGAIN, url: null };
    return openSubscription({
      userId: data.userId,
      email: user.user.email ?? null,
      plan: "inteligencia",
      period: data.period,
      origin: new URL(getRequest().url).origin,
      existing,
    });
  });

/** Busca a assinatura no Mercado Pago e grava o status, como o webhook faria (para quando ele falhou). */
export const adminResyncSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: admin } = await context.supabase.rpc("is_admin");
    if (admin !== true) return { error: NOT_ADMIN, status: null };
    const token = mpToken();
    if (!token) return { error: NOT_CONFIGURED, status: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub, error } = await supabaseAdmin.from("subscriptions").select("preapproval_id").eq("user_id", data.userId).maybeSingle();
    if (error) return { error: TRY_AGAIN, status: null };
    if (!sub) return { error: "Esta conta não tem assinatura registrada.", status: null };

    const pre = await mpRequest(token, `/preapproval/${encodeURIComponent(sub.preapproval_id)}`, MpPreapprovalSchema);
    if (!pre) return { error: TRY_AGAIN, status: null };
    const decision = decidePreapproval(pre);
    // A referência precisa apontar para a mesma conta: senão o registro está trocado e não mexemos.
    if (decision.action !== "subscription" || decision.userId !== data.userId)
      return { error: "A assinatura no Mercado Pago não confere com esta conta.", status: null };

    const saved = await supabaseAdmin
      .from("subscriptions")
      .update({ status: decision.status, plan: decision.plan, period: decision.period, updated_at: new Date().toISOString() })
      .eq("user_id", data.userId);
    if (saved.error) return { error: TRY_AGAIN, status: null };
    return { error: null, status: decision.status };
  });
