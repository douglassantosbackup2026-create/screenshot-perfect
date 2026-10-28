// Assinatura recorrente no Mercado Pago (preapproval): criar e cancelar.
// O acesso só muda pelo webhook, que confere cada cobrança na API do Mercado Pago.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildReference, PLAN_NAMES, priceCents } from "./catalog";
import { APP_NAME } from "@/lib/seo";

const MP = "https://api.mercadopago.com";
const NOT_CONFIGURED = "O pagamento ainda não está configurado." as const;

/** Abre a assinatura no Mercado Pago e devolve o link para a pessoa autorizar o cartão. */
export const createSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  // Só o Inteligência está à venda; o Pro ainda é lista de espera.
  .validator((d) => z.object({ plan: z.literal("inteligencia"), period: z.enum(["mensal", "anual"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const token = process.env["MERCADO_PAGO_ACCESS_TOKEN"];
    if (!token) return { error: NOT_CONFIGURED, url: null };
    const cents = priceCents(data.plan, data.period);
    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    if (cents === null || !email) return { error: "Não foi possível abrir a assinatura para esta conta." as const, url: null };

    const { data: existing } = await context.supabase.from("subscriptions").select("status").eq("user_id", context.userId).maybeSingle();
    if (existing?.status === "authorized") return { error: "Você já tem uma assinatura ativa." as const, url: null };

    const origin = new URL(getRequest().url).origin;
    const res = await fetch(`${MP}/preapproval`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
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
      }),
    });
    if (!res.ok) {
      console.error(`Mercado Pago preapproval failed [${res.status}]: ${await res.text()}`);
      return { error: "Não foi possível abrir a assinatura agora. Tente de novo em instantes." as const, url: null };
    }
    const pre = (await res.json()) as { init_point?: string };
    return { error: null, url: pre.init_point ?? null };
  });

/** Cancela as próximas cobranças. O acesso continua até o fim do período já pago. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Sem assinatura (ou já cancelada) não há o que cancelar, nem com o Mercado Pago desligado.
    const { data: sub } = await context.supabase.from("subscriptions").select("preapproval_id, status").eq("user_id", context.userId).maybeSingle();
    if (!sub || sub.status === "cancelled") return { error: null };
    const token = process.env["MERCADO_PAGO_ACCESS_TOKEN"];
    if (!token) return { error: NOT_CONFIGURED };

    const res = await fetch(`${MP}/preapproval/${encodeURIComponent(sub.preapproval_id)}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!res.ok) {
      console.error(`Mercado Pago cancel failed [${res.status}]: ${await res.text()}`);
      return { error: "Não foi possível cancelar agora. Tente de novo em instantes." };
    }
    // O webhook também grava; gravar aqui faz a tela mostrar o cancelamento na hora.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("user_id", context.userId);
    return { error: null };
  });
