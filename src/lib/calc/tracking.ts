// Projetado × real: compara o patrimônio registrado com a foto do plano (âncora).
// A âncora é congelada: editar o plano depois não move a comparação.
// O corredor vai do cenário conservador (borda baixa) ao otimista (borda alta).
// Funções puras. Valores em reais de hoje.

import {
  effectiveRealReturn,
  futureValue,
  monthlyRate,
  type PlanInputs,
  type ScenarioKey,
} from "./retirement";
import type { WealthPoint } from "./progress";

/** Abaixo do corredor, mas a menos de 7% da borda baixa, ainda é ruído de curto prazo. */
export const NOISE_TOLERANCE = 0.07;

export type CorridorPoint = {
  month: string; // "YYYY-MM-01"
  low: number; // cenário conservador
  central: number;
  high: number; // cenário otimista
  actual: number | null; // patrimônio registrado no mês
}

export type VerdictCode = "a_frente" | "no_ritmo" | "levemente_atras" | "atras";

export type Verdict = {
  code: VerdictCode;
  month: string;
  actual: number;
  central: number;
  deviation: number; // real − central
  shortfallPct: number; // quanto falta para a borda baixa, em fração dela (0 quando dentro ou acima)
}

export type RetirementImpact = {
  plannedAtRetirement: number; // cenário central da âncora
  paceAtRetirement: number; // partindo do patrimônio real de hoje, com o aporte do plano
  deltaPct: number; // pace ÷ planned − 1
  monthsLate: number; // > 0: meses a mais para chegar ao planejado; < 0: meses de folga
}

function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

function shiftMonth(month: string, n: number): string {
  const idx = monthIndex(month) + n;
  const y = Math.floor(idx / 12);
  return `${y}-${String(idx - y * 12 + 1).padStart(2, "0")}-01`;
}

function rateFor(i: PlanInputs, s: ScenarioKey): number {
  return monthlyRate(effectiveRealReturn(i.returns[s], i.costsAA));
}

/** Corredor mensal da âncora até `endMonth`, com o patrimônio registrado em cada mês (o último registro do mês vale). */
export function planCorridor(
  anchor: PlanInputs,
  anchorMonth: string,
  entries: WealthPoint[],
  endMonth: string,
): CorridorPoint[] {
  const n = monthIndex(endMonth) - monthIndex(anchorMonth);
  if (n < 0) return [];
  const actual = new Map<string, number>();
  for (const e of entries) actual.set(e.month, e.total);
  const lo = rateFor(anchor, "conservador");
  const mid = rateFor(anchor, "central");
  const hi = rateFor(anchor, "otimista");
  const w0 = anchor.initialWealth;
  const c = anchor.monthlyContribution;
  return Array.from({ length: n + 1 }, (_, k) => {
    const month = shiftMonth(anchorMonth, k);
    return {
      month,
      low: futureValue(w0, c, lo, k),
      central: futureValue(w0, c, mid, k),
      high: futureValue(w0, c, hi, k),
      actual: actual.get(month) ?? null,
    };
  });
}

/** Veredito do registro mais recente dentro do corredor. Sem registro, null. */
export function progressVerdict(
  points: CorridorPoint[],
  tolerance = NOISE_TOLERANCE,
): Verdict | null {
  const p = [...points].reverse().find((x) => x.actual !== null);
  if (!p || p.actual === null) return null;
  const a = p.actual;
  const shortfallPct = a < p.low && p.low > 0 ? (p.low - a) / p.low : 0;
  const code: VerdictCode =
    a > p.high
      ? "a_frente"
      : a >= p.low
        ? "no_ritmo"
        : shortfallPct < tolerance
          ? "levemente_atras"
          : "atras";
  return {
    code,
    month: p.month,
    actual: a,
    central: p.central,
    deviation: a - p.central,
    shortfallPct,
  };
}

const MAX_SHIFT = 600;

/**
 * Impacto na aposentadoria, no cenário central: partindo do patrimônio real de `month`,
 * com o aporte da âncora, quanto se chega na idade planejada e quantos meses a mais
 * (ou a menos) seriam precisos para chegar ao patrimônio planejado.
 * Null quando o mês já passou da aposentadoria.
 */
export function retirementImpact(
  anchor: PlanInputs,
  anchorMonth: string,
  month: string,
  actual: number,
): RetirementImpact | null {
  const total = Math.round((anchor.retirementAge - anchor.currentAge) * 12);
  const elapsed = monthIndex(month) - monthIndex(anchorMonth);
  const remaining = total - elapsed;
  if (elapsed < 0 || remaining <= 0) return null;
  const rm = rateFor(anchor, "central");
  const c = anchor.monthlyContribution;
  const planned = futureValue(anchor.initialWealth, c, rm, total);
  const pace = futureValue(actual, c, rm, remaining);
  let monthsLate = 0;
  if (pace < planned) {
    while (monthsLate < MAX_SHIFT && futureValue(actual, c, rm, remaining + monthsLate) < planned)
      monthsLate++;
  } else {
    let m = 0;
    while (m < remaining && futureValue(actual, c, rm, remaining - (m + 1)) >= planned) m++;
    monthsLate = m > 0 ? -m : 0;
  }
  return {
    plannedAtRetirement: planned,
    paceAtRetirement: pace,
    deltaPct: planned > 0 ? pace / planned - 1 : 0,
    monthsLate,
  };
}
