// Preços de hoje para mostrar na tela (landing, Assinatura, prévias do admin). Leitura pública de plan_prices;
// se o banco não responder, mostra os valores de partida. Quem decide o valor cobrado é o servidor.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_PRICES_CENTS, type BillingPeriod, type PaidPlan, type PlanPrices } from "./catalog";

export type PriceRow = { plan: PaidPlan; period: BillingPeriod; cents: number; updated_at: string };

export async function fetchPriceRows(): Promise<PriceRow[] | null> {
  try {
    const { data, error } = await supabase.from("plan_prices").select("plan, period, cents, updated_at");
    return error ? null : (data as PriceRow[]);
  } catch {
    return null;
  }
}

export function toPlanPrices(rows: PriceRow[] | null): PlanPrices {
  const prices: PlanPrices = { inteligencia: { ...DEFAULT_PRICES_CENTS.inteligencia }, pro: { ...DEFAULT_PRICES_CENTS.pro } };
  for (const r of rows ?? []) if (prices[r.plan]?.[r.period] !== undefined) prices[r.plan][r.period] = r.cents;
  return prices;
}

export async function fetchPlanPrices(): Promise<PlanPrices> {
  return toPlanPrices(await fetchPriceRows());
}

/** Preços de hoje; começa pelos de partida e troca quando o banco responde. `reload` busca de novo. */
export function usePlanPrices(): { prices: PlanPrices; rows: PriceRow[] | null; reload: () => void } {
  const [rows, setRows] = useState<PriceRow[] | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    void fetchPriceRows().then((r) => live && r && setRows(r));
    return () => {
      live = false;
    };
  }, [version]);
  return { prices: toPlanPrices(rows), rows, reload: () => setVersion((v) => v + 1) };
}
