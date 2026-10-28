import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildReference, PLAN_NAMES, priceCents, type BillingPeriod, type PaidPlan } from "./catalog";

export const createCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d) => z.object({ plan: z.enum(["inteligencia", "pro"]), period: z.enum(["mensal", "anual"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const token = process.env["MERCADO_PAGO_ACCESS_TOKEN"];
    if (!token) return { error: "O pagamento ainda não está configurado." as const, url: null };
    const cents = priceCents(data.plan, data.period);
    if (cents === null) return { error: "Esse período não está disponível para o plano." as const, url: null };

    const origin = new URL(getRequest().url).origin;
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [
          {
            id: `${data.plan}-${data.period}`,
            title: `Previdência Intelligence ${PLAN_NAMES[data.plan as PaidPlan]} (${data.period})`,
            quantity: 1,
            currency_id: "BRL",
            unit_price: cents / 100,
          },
        ],
        external_reference: buildReference(context.userId, data.plan as PaidPlan, data.period as BillingPeriod),
        back_urls: { success: `${origin}/pagamento`, pending: `${origin}/pagamento`, failure: `${origin}/pagamento` },
        auto_return: "approved",
        notification_url: `${origin}/api/public/mercadopago/webhook`,
      }),
    });
    if (!res.ok) {
      console.error(`Mercado Pago preference failed [${res.status}]: ${await res.text()}`);
      return { error: "Não foi possível abrir o pagamento agora. Tente de novo em instantes." as const, url: null };
    }
    const pref = (await res.json()) as { init_point?: string };
    return { error: null, url: pref.init_point ?? null };
  });
