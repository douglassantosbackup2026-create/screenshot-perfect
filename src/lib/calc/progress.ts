// Evolução patrimonial: progresso rumo à independência e comparação com a própria situação anterior.
// Funções puras. Valores em reais de hoje. Nunca compara uma pessoa com outra.

import { effectiveRealReturn, futureValue, monthlyRate, simulate, type PlanInputs } from './retirement';

export type WealthPoint = {
  month: string; // "YYYY-MM-01"
  total: number;
}

export type MonthlyAmount = {
  month: string; // "YYYY-MM-01"
  amount: number;
}

export type FiProgress = {
  ratio: number;                       // patrimônio atual ÷ patrimônio-alvo, entre 0 e 1
  targetWealth: number;                // cenário central, sem INSS
  projectedRatioAtRetirement: number;  // cobertura projetada na aposentadoria
}

export function fiProgress(inputs: PlanInputs, currentWealth: number): FiProgress {
  const r = simulate(inputs, 'central', false);
  const ratio = r.targetWealth > 0 ? Math.min(Math.max(currentWealth / r.targetWealth, 0), 1) : 1;
  return { ratio, targetWealth: r.targetWealth, projectedRatioAtRetirement: r.coverageRatio };
}

export type TimelinePoint = {
  month: string;
  total: number;
  deltaFromPrevious: number | null;    // null no primeiro registro
  contributionsInPeriod: number;       // aportes registrados desde o registro anterior (inclusive o mês atual)
  otherChange: number | null;          // variação que não veio de aportes: rendimento, saques, ajustes
}

/** Ordena os registros por mês (o último registro de cada mês vale) e separa aporte de rendimento. */
export function wealthTimeline(entries: WealthPoint[], contributions: MonthlyAmount[] = []): TimelinePoint[] {
  const byMonth = new Map<string, number>();
  for (const e of entries) byMonth.set(e.month, e.total);
  const months = [...byMonth.keys()].sort();
  return months.map((month, i) => {
    const total = byMonth.get(month)!;
    const prev = i > 0 ? months[i - 1]! : null;
    const contributionsInPeriod = prev === null
      ? 0
      : contributions.filter(c => c.month > prev && c.month <= month).reduce((a, c) => a + c.amount, 0);
    const delta = prev === null ? null : total - byMonth.get(prev)!;
    return {
      month,
      total,
      deltaFromPrevious: delta,
      contributionsInPeriod,
      otherChange: delta === null ? null : delta - contributionsInPeriod,
    };
  });
}

function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

export type SelfComparison = {
  fromMonth: string;
  toMonth: string;
  delta: number;
  ratioChange: number | null; // variação relativa; null quando o ponto de partida é zero
}

/**
 * Compara o registro mais recente com o registro de N meses antes (ou o mais próximo anterior a isso).
 * Sem registro antigo o bastante, compara com o primeiro registro. Com menos de dois registros, devolve null.
 */
export function selfComparison(entries: WealthPoint[], months: number): SelfComparison | null {
  const tl = wealthTimeline(entries);
  if (tl.length < 2) return null;
  const last = tl[tl.length - 1]!;
  const limit = monthIndex(last.month) - months;
  const candidates = tl.slice(0, -1).filter(p => monthIndex(p.month) <= limit);
  const from = candidates.length ? candidates[candidates.length - 1]! : tl[0]!;
  const delta = last.total - from.total;
  return {
    fromMonth: from.month,
    toMonth: last.month,
    delta,
    ratioChange: from.total > 0 ? delta / from.total : null,
  };
}

/** Progresso de uma meta de valor: patrimônio atual ÷ valor da meta, entre 0 e 1. */
export function goalProgress(currentWealth: number, target: number): number {
  if (!(target > 0)) return 1;
  return Math.min(Math.max(currentWealth / target, 0), 1);
}

/**
 * Caminho mensal projetado a partir do patrimônio atual, no cenário central, com o aporte do plano.
 * Usado para a linha tracejada da linha do tempo. Índice 0 é o ponto de partida.
 */
export function projectMonthlyPath(inputs: PlanInputs, startWealth: number, months: number): number[] {
  const rm = monthlyRate(effectiveRealReturn(inputs.returns.central, inputs.costsAA));
  return Array.from({ length: months + 1 }, (_, k) => futureValue(startWealth, inputs.monthlyContribution, rm, k));
}

export type ContributionRecord = {
  month: string; // "YYYY-MM-01"
  made: boolean;
  amount: number | null;
  destination: string | null;
}

function shiftMonth(month: string, n: number): string {
  const idx = monthIndex(month) + n;
  const y = Math.floor(idx / 12);
  const m = idx - y * 12 + 1;
  return `${y}-${String(m).padStart(2, '0')}-01`;
}

/** Aportes somados por mês, terminando em `endMonth`, com meses vazios valendo 0. */
export function monthlyContributionSeries(contributions: ContributionRecord[], endMonth: string, count: number): MonthlyAmount[] {
  return Array.from({ length: count }, (_, i) => {
    const month = shiftMonth(endMonth, i - count + 1);
    const amount = contributions
      .filter(c => c.made && c.month === month)
      .reduce((a, c) => a + (c.amount ?? 0), 0);
    return { month, amount };
  });
}

export type DestinationShare = {
  destination: string | null; // null = não informado
  amount: number;
  share: number;              // fração do total, soma 1
}

/** Total aportado por destino, do maior para o menor. Sem valores informados, lista vazia. */
export function contributionsByDestination(contributions: ContributionRecord[]): DestinationShare[] {
  const totals = new Map<string | null, number>();
  for (const c of contributions) {
    if (!c.made || !c.amount || c.amount <= 0) continue;
    totals.set(c.destination, (totals.get(c.destination) ?? 0) + c.amount);
  }
  const total = [...totals.values()].reduce((a, v) => a + v, 0);
  if (total <= 0) return [];
  return [...totals.entries()]
    .map(([destination, amount]) => ({ destination, amount, share: amount / total }))
    .sort((a, b) => b.amount - a.amount);
}
