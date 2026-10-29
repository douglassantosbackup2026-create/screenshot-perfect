// Assinatura recorrente no Mercado Pago (preapproval): criar e cancelar.
// O acesso só muda pelo webhook, que confere cada cobrança na API do Mercado Pago.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildReference, PLAN_NAMES, priceCents } from "./catalog";
import { mpRequest, mpToken } from "./mercadopago";
import { MpPreapprovalSchema } from "./webhook";
import { APP_NAME } from "@/lib/seo";

const NOT_CONFIGURED = "O pagamento ainda não está configurado." as const;
const TRY_AGAIN = "Não foi possível falar com o Mercado Pago agora. Tente de novo em instantes." as const;

/** Abre a assinatura no Mercado Pago e devolve o link para a pessoa autorizar o cartão. */
export const createSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Só o Inteligência está à venda; o Pro ainda é lista de espera.
  .validator((d) => z.object({ plan: z.literal("inteligencia"), period: z.enum(["mensal", "anual"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const token = mpToken();
    if (!token) return { error: NOT_CONFIGURED, url: null };
    const cents = priceCents(data.plan, data.period);
    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    if (cents === null || !email) return { error: "Não foi possível abrir a assinatura para esta conta." as const, url: null };

    // Sem saber se já existe assinatura, não cria outra: o risco é cobrar duas vezes.
    const { data: existing, error } = await context.supabase
      .from("subscriptions")
      .select("preapproval_id, status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) return { error: TRY_AGAIN, url: null };
    if (existing?.status === "authorized" || existing?.status === "paused")
      return { error: "Você já tem uma assinatura. Veja os detalhes em Assinatura." as const, url: null };
    // Uma tentativa anterior ficou sem autorizar: cancela antes, para as duas nunca serem cobradas.
    if (existing?.status === "pending") {
      const cancelled = await mpRequest(token, `/preapproval/${encodeURIComponent(existing.preapproval_id)}`, MpPreapprovalSchema, {
        method: "PUT",
        body: { status: "cancelled" },
      });
      if (!cancelled) return { error: TRY_AGAIN, url: null };
    }

    const origin = new URL(getRequest().url).origin;
    const pre = await mpRequest(token, "/preapproval", MpPreapprovalSchema, {
      method: "POST",
      body: {
        reason: `${APP_NAME} ${PLAN_NAMES[data.plan]} (${data.period})`,
        external_reference: buildReference(context.userId, data.plan, data.period),
        payer_email: email,
        auto_recurring: {
          frequency: data.period === "anual" ? 12 : 1,
          frequency_type: "months",
          transaction_amount: cents / 100,
          currency_id: "BRL",
        },
        back_url: `${origin}/pagamento`,
        status: "pending",
      },
    });
    if (!pre?.init_point) return { error: TRY_AGAIN, url: null };

    // Registra já como pendente: um segundo clique encontra esta e a cancela, em vez de abrir outra em paralelo.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const saved = await supabaseAdmin.from("subscriptions").upsert({
      user_id: context.userId,
      preapproval_id: pre.id,
      plan: data.plan,
      period: data.period,
      status: "pending",
      updated_at: new Date().toISOString(),
    });
    if (saved.error) {
      console.error("subscription pending upsert failed", saved.error.message);
      return { error: TRY_AGAIN, url: null };
    }
    return { error: null, url: pre.init_point };
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
