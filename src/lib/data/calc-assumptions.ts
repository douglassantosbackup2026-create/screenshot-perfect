// Premissas padrão da calculadora (retornos, inflação, horizonte, custos), editáveis no painel em calc_settings.
// Leitura pública; se o banco não responder, valem as de DEFAULT_ASSUMPTIONS. Planos já salvos guardam as
// próprias premissas e não mudam quando estas mudam.
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_ASSUMPTIONS } from "./demo-store";

export type CalcAssumptions = typeof DEFAULT_ASSUMPTIONS;

export type CalcSettingsRow = {
  return_conservador: number;
  return_central: number;
  return_otimista: number;
  inflation: number;
  horizon: number;
  costs: number;
  updated_at: string;
};

export function assumptionsFrom(row: CalcSettingsRow | null): CalcAssumptions {
  if (!row) return { ...DEFAULT_ASSUMPTIONS, returns: { ...DEFAULT_ASSUMPTIONS.returns } };
  return {
    horizonAge: Number(row.horizon),
    returns: { conservador: Number(row.return_conservador), central: Number(row.return_central), otimista: Number(row.return_otimista) },
    inflationAA: Number(row.inflation),
    costsAA: Number(row.costs),
  };
}

export async function fetchCalcSettings(): Promise<CalcSettingsRow | null> {
  try {
    const { data, error } = await supabase
      .from("calc_settings")
      .select("return_conservador, return_central, return_otimista, inflation, horizon, costs, updated_at")
      .maybeSingle();
    return error ? null : (data as CalcSettingsRow | null);
  } catch {
    return null;
  }
}

export async function fetchCalcAssumptions(): Promise<CalcAssumptions> {
  return assumptionsFrom(await fetchCalcSettings());
}
