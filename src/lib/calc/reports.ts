// Relatórios: fluxo de caixa, gastos por categoria ao longo dos meses e patrimônio por grupo. Funções puras.
// Dinheiro do livro-caixa em centavos; patrimônio em reais (como os itens do Patrimônio).

import type { AssetCategory } from './assets';
import { monthSummary, spendingByCategory, type LedgerTx } from './ledger';
import type { Valuation } from './networth';

export interface CashFlowPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
  savingsRate: number | null; // sobra ÷ renda; null sem renda
}

/** Entradas, saídas e sobra de cada mês, sem transferências. */
export function cashFlowSeries(txs: LedgerTx[], months: string[]): CashFlowPoint[] {
  return months.map((month) => {
    const m = monthSummary(txs, month);
    return { month, income: m.income, expense: m.expense, net: m.net, savingsRate: m.income > 0 ? m.net / m.income : null };
  });
}

/** Somas do período e a taxa de poupança do período (sobra total ÷ renda total). */
export function cashFlowTotals(points: CashFlowPoint[]) {
  const income = points.reduce((a, p) => a + p.income, 0);
  const expense = points.reduce((a, p) => a + p.expense, 0);
  const withIncome = points.filter((p) => p.income > 0);
  // Média só dos meses com movimento: meses antes de começar a lançar não puxam a média para baixo.
  const active = points.filter((p) => p.income > 0 || p.expense > 0);
  return {
    income,
    expense,
    net: income - expense,
    savingsRate: income > 0 ? (income - expense) / income : null,
    averageExpense: active.length ? Math.round(expense / active.length) : 0,
    monthsWithSurplus: withIncome.filter((p) => p.net > 0).length,
    monthsWithIncome: withIncome.length,
  };
}

export const OTHER_KEY = 'outros';
export const UNCATEGORIZED_KEY = 'sem-categoria';

export interface CategoryTrend {
  keys: string[]; // categorias que ganham cor própria, da maior para a menor, e por último "outros" se houver
  rows: ({ month: string } & Record<string, number | string>)[]; // centavos por chave, em cada mês
  totals: Record<string, number>;
}

/**
 * Gastos por categoria mês a mês. As `topN` categorias que mais gastaram em `rankMonths` ganham cor própria;
 * o resto vai para "outros". Classificar num período fixo (todo o histórico) mantém a cor de cada categoria
 * quando o período mostrado muda.
 */
export function categoryTrend(txs: LedgerTx[], months: string[], rankMonths: string[], topN = 4): CategoryTrend {
  const key = (id: string | null) => id ?? UNCATEGORIZED_KEY;
  const rank = new Map<string, number>();
  for (const m of rankMonths) for (const c of spendingByCategory(txs, m)) rank.set(key(c.categoryId), (rank.get(key(c.categoryId)) ?? 0) + c.amount);
  const top = [...rank.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([k]) => k);
  const topSet = new Set(top);
  let hasOther = false;
  const totals: Record<string, number> = {};
  const rows = months.map((month) => {
    const row: { month: string } & Record<string, number | string> = { month };
    for (const k of top) row[k] = 0;
    for (const c of spendingByCategory(txs, month)) {
      const k = topSet.has(key(c.categoryId)) ? key(c.categoryId) : OTHER_KEY;
      if (k === OTHER_KEY) hasOther = true;
      row[k] = ((row[k] as number | undefined) ?? 0) + c.amount;
      totals[k] = (totals[k] ?? 0) + c.amount;
    }
    return row;
  });
  if (hasOther) for (const r of rows) r[OTHER_KEY] ??= 0;
  return { keys: hasOther ? [...top, OTHER_KEY] : top, rows, totals };
}

export type WealthGroup = 'previdencia' | 'investimentos' | 'reserva' | 'imovel' | 'outros';
export const WEALTH_GROUPS: { key: WealthGroup; label: string }[] = [
  { key: 'previdencia', label: 'Previdência' },
  { key: 'investimentos', label: 'Investimentos' },
  { key: 'reserva', label: 'Reserva' },
  { key: 'imovel', label: 'Imóvel' },
  { key: 'outros', label: 'Outros' },
];

/** Grupo do item no relatório de patrimônio. Dívidas e rendas futuras não entram. */
export function wealthGroupOf(c: AssetCategory): WealthGroup | null {
  if (c === 'pgbl' || c === 'vgbl') return 'previdencia';
  if (c === 'investimentos') return 'investimentos';
  if (c === 'reserva') return 'reserva';
  if (c === 'imovel') return 'imovel';
  if (c === 'outro') return 'outros';
  return null;
}

/**
 * Patrimônio de cada mês por grupo, a partir do histórico dos itens. Num mês sem registro, vale o último
 * valor anterior do item; antes do primeiro registro, o item não existia (zero).
 */
export function wealthByGroup(assets: { id: string; category: AssetCategory }[], valuations: Valuation[], months: string[]) {
  const history = new Map<string, Valuation[]>();
  for (const v of valuations) history.set(v.assetId, [...(history.get(v.assetId) ?? []), v]);
  for (const list of history.values()) list.sort((a, b) => a.month.localeCompare(b.month));
  return months.map((month) => {
    const row: { month: string } & Record<WealthGroup, number> = { month, previdencia: 0, investimentos: 0, reserva: 0, imovel: 0, outros: 0 };
    for (const a of assets) {
      const g = wealthGroupOf(a.category);
      if (!g) continue;
      const last = (history.get(a.id) ?? []).filter((v) => v.month <= month).at(-1);
      if (last) row[g] += last.value;
    }
    return row;
  });
}
