// Simulação iniciada = primeira mudança num campo da calculadora; concluída = primeiro resultado válido
// mostrado depois disso. Uma vez de cada por página aberta, para não contar a mesma pessoa digitando.
// Conta sempre de forma anônima; com aceite, manda também as faixas (nunca os números digitados).
import { useCallback, useMemo, useRef } from "react";
import { ageBand, incomeBand, monthlyBand } from "@/lib/calc/business";
import { countAnonymous, track } from "./analytics";

export function useSimulationTracking() {
  const done = useRef({ started: false, completed: false });

  const started = useCallback(() => {
    if (done.current.started) return;
    done.current.started = true;
    countAnonymous("simulacao_iniciada");
    track("calculator_started");
  }, []);

  const completed = useCallback((r: { age: number; income: number; monthly: number }) => {
    if (!done.current.started || done.current.completed) return;
    done.current.completed = true;
    countAnonymous("simulacao_concluida");
    track("calculator_completed", { age_band: ageBand(r.age), income_band: incomeBand(r.income), monthly_band: monthlyBand(r.monthly) });
  }, []);

  return useMemo(() => ({ started, completed }), [started, completed]);
}
