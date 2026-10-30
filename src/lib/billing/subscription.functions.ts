// Assinatura recorrente no Mercado Pago (preapproval): criar e cancelar.
// O acesso só muda pelo webhook, que confere cada cobrança na API do Mercado Pago.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { mpRequest, mpToken } from "./mercadopago";
import { MpPreapprovalSchema } from "./webhook";
import { NOT_CONFIGURED, openSubscription, TRY_AGAIN } from "./open-subscription";

/** Abre a assinatura no Mercado Pago e devolve o link para a pessoa autorizar o cartão. */
export const createSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Só o Inteligência está à venda; o Pro ainda é lista de espera.
  .validator((d) => z.object({ plan: z.literal("inteligencia"), period: z.enum(["mensal", "anual"]) }).parse(d))
  .handler(async ({ data, context }) => {
    // Sem saber se já existe assinatura, não cria outra: o risco é cobrar duas vezes.
    const { data: existing, error } = await context.supabase
      .from("subscriptions")
      .select("preapproval_id, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) return { error: TRY_AGAIN, url: null };
    return openSubscription({
      userId: context.userId,
      email: typeof context.claims.email === "string" ? context.claims.email : null,
      plan: data.plan,
      period: data.period,
      origin: new URL(getRequest().url).origin,
      existing,
    });
  });

/** Cancela as próximas cobranças. O acesso continua até o fim do período já pago. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("preapproval_id, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    // Erro na leitura não é "sem assinatura": quem chama (excluir a conta) precisa parar aqui.
    if (error) return { error: "Não foi possível conferir sua assinatura agora. Tente de novo em instantes." };
    // Sem assinatura (ou já cancelada) não há o que cancelar, nem com o Mercado Pago desligado.
    if (!sub || sub.status === "cancelled") return { error: null };
    const token = mpToken();
    if (!token) return { error: NOT_CONFIGURED };

    const res = await mpRequest(token, `/preapproval/${encodeURIComponent(sub.preapproval_id)}`, MpPreapprovalSchema, {
      method: "PUT",
      body: { status: "cancelled" },
    });
    if (!res) return { error: "Não foi possível cancelar agora. Tente de novo em instantes." };
    // O webhook também grava; gravar aqui faz a tela mostrar o cancelamento na hora.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("subscriptions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", context.userId);
    return { error: null };
  });
