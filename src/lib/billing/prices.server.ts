// Preço de hoje de um plano, lido do banco (plan_prices) com o service role. Só no servidor: é o valor que vai
// para o Mercado Pago. Sem o preço no banco, não abre a assinatura (nunca cobra um valor de reserva em silêncio).
import { defaultPriceCents, type BillingPeriod, type PaidPlan } from "./catalog";

export async function currentPriceCents(plan: PaidPlan, period: BillingPeriod): Promise<number | null> {
  if (defaultPriceCents(plan, period) === null) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("plan_prices").select("cents").eq("plan", plan).eq("period", period).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.cents ?? null;
}
