// Patrimônio ao longo do tempo: histórico por item, foto do mês a partir dos itens,
// rendimento estimado (aportes x o resto) e marcos rumo à independência. Funções puras.

import { isIncomeSource, isLiability, summarizeAssets, type AssetCategory, type AssetItem } from './assets';
import type { TimelinePoint } from './progress';

export interface Valuation {
  assetId: string;
  month: string; // "YYYY-MM-01"
  value: number;
}

export interface HistoryPoint {
  month: string;
  value: number;
  delta: number | null; // null no primeiro registro
}

/** Valores de um item, um por mês (o último registro do mês vale), do mais antigo para o mais recente. */
export function assetHistory(valuations: Valuation[], assetId: string): HistoryPoint[] {
  const byMonth = new Map<string, number>();
  for (const v of valuations) if (v.assetId === assetId) byMonth.set(v.month, v.value);
  const months = [...byMonth.keys()].sort();
  return months.map((month, i) => {
    const value = byMonth.get(month)!;
    return { month, value, delta: i === 0 ? null : value - byMonth.get(months[i - 1]!)! };
  });
}

export interface SnapshotItem extends AssetItem {
  id: string;
  name: string;
}

export interface BreakdownItem {
  assetId: string;
  name: string;
  category: AssetCategory;
  value: number;
}

export interface AssetSnapshot {
  total: number;       // o mesmo total que o plano usa: ativos destinados à aposentadoria
  previdencia: number; // parte do total em PGBL e VGBL
  breakdown: BreakdownItem[];
}

const countsForRetirement = (a: AssetItem) => a.forRetirement && !isLiability(a.category) && !isIncomeSource(a.category);

/** Foto do patrimônio do mês montada a partir dos itens cadastrados. Dívidas e rendas ficam de fora, como no plano. */
export function snapshotFromAssets(items: SnapshotItem[]): AssetSnapshot {
  const included = items.filter(countsForRetirement);
  return {
    total: summarizeAssets(items).retirementTotal,
    previdencia: included.filter((a) => a.category === 'pgbl' || a.category === 'vgbl').reduce((t, a) => t + a.value, 0),
    breakdown: included.map((a) => ({ assetId: a.id, name: a.name, category: a.category, value: a.value })),
  };
}

/**
 * Rendimento de um período pelo método de Dietz modificado, com os aportes entrando no meio do período:
 * (fim − início − aportes) ÷ (início + aportes ÷ 2). Sem base positiva, devolve null.
 */
export function modifiedDietz(start: number, end: number, contributions: number): number | null {
  const base = start + contributions / 2;
  if (!(base > 0)) return null;
  return (end - start - contributions) / base;
}

export interface PeriodReturn {
  month: string;
  rate: number | null;
}

/** Rendimento estimado de cada período entre dois registros de patrimônio. O primeiro registro não tem período. */
export function periodReturns(timeline: TimelinePoint[]): PeriodReturn[] {
  return timeline.slice(1).map((p, i) => ({
    month: p.month,
    rate: modifiedDietz(timeline[i]!.total, p.total, p.contributionsInPeriod),
  }));
}

/** Encadeia os períodos, (1 + r₁)(1 + r₂)… − 1, pulando os que não têm base. Sem nenhum período válido, null. */
export function cumulativeReturn(rates: (number | null)[]): number | null {
  const valid = rates.filter((r): r is number => r !== null);
  if (valid.length === 0) return null;
  return valid.reduce((acc, r) => acc * (1 + r), 1) - 1;
}

export interface GrowthSummary {
  fromMonth: string;
  toMonth: string;
  growth: number;        // total mais recente − primeiro total
  contributions: number; // parte que veio de aportes registrados
  other: number;         // rendimento, saques e ajustes
}

/** Separa o crescimento desde o primeiro registro entre aportes e o resto. Com menos de dois registros, null. */
export function growthSummary(timeline: TimelinePoint[]): GrowthSummary | null {
  if (timeline.length < 2) return null;
  const first = timeline[0]!;
  const last = timeline[timeline.length - 1]!;
  const contributions = timeline.slice(1).reduce((t, p) => t + p.contributionsInPeriod, 0);
  const growth = last.total - first.total;
  return { fromMonth: first.month, toMonth: last.month, growth, contributions, other: growth - contributions };
}

export const FI_MILESTONES = [0.25, 0.5, 0.75, 1] as const;

export interface Milestone {
  ratio: number;
  reached: boolean;
}

/** Marcos de 25%, 50%, 75% e 100% do patrimônio-alvo, e o próximo a alcançar (null quando todos foram). */
export function fiMilestones(ratio: number): { milestones: Milestone[]; next: number | null } {
  const milestones = FI_MILESTONES.map((m) => ({ ratio: m, reached: ratio >= m }));
  return { milestones, next: milestones.find((m) => !m.reached)?.ratio ?? null };
}
