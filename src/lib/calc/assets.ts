// Patrimônio informado pelo usuário, item a item. Funções puras.
// Nada é somado de forma opaca: aposentadoria, outros ativos, dívidas e rendas ficam em baldes separados.

export type AssetCategory = 'pgbl' | 'vgbl' | 'investimentos' | 'reserva' | 'imovel' | 'beneficio' | 'divida' | 'outro';

export const ASSET_CATEGORIES: { key: AssetCategory; label: string; monthly?: boolean; liability?: boolean }[] = [
  { key: 'pgbl', label: 'Previdência PGBL' },
  { key: 'vgbl', label: 'Previdência VGBL' },
  { key: 'investimentos', label: 'Investimentos' },
  { key: 'reserva', label: 'Reserva de emergência' },
  { key: 'imovel', label: 'Imóvel' },
  { key: 'outro', label: 'Outro ativo' },
  { key: 'beneficio', label: 'Benefício ou renda futura', monthly: true },
  { key: 'divida', label: 'Dívida ou obrigação', liability: true },
];

export const categoryLabel = (c: AssetCategory) => ASSET_CATEGORIES.find((x) => x.key === c)?.label ?? c;
export const isIncomeSource = (c: AssetCategory) => c === 'beneficio';
export const isLiability = (c: AssetCategory) => c === 'divida';

export interface AssetItem {
  category: AssetCategory;
  value: number;          // saldo em R$; para 'beneficio', valor mensal estimado
  forRetirement: boolean; // o usuário pretende usar este ativo na aposentadoria
  updatedAt: string;      // ISO
}

export interface AssetSummary {
  retirementTotal: number;      // ativos destinados à aposentadoria
  otherTotal: number;           // ativos que não serão usados para esse objetivo
  debtsTotal: number;
  incomeSourcesMonthly: number; // benefícios e outras rendas mensais estimadas
  byCategory: Partial<Record<AssetCategory, number>>;
  oldestUpdate: string | null;
}

export function validateAsset(a: Pick<AssetItem, 'value'> & { name: string }): string[] {
  const e: string[] = [];
  if (!a.name.trim()) e.push('Dê um nome ao item.');
  if (!(Number.isFinite(a.value) && a.value >= 0)) e.push('Informe um valor igual ou maior que zero.');
  return e;
}

export function summarizeAssets(items: AssetItem[]): AssetSummary {
  const s: AssetSummary = { retirementTotal: 0, otherTotal: 0, debtsTotal: 0, incomeSourcesMonthly: 0, byCategory: {}, oldestUpdate: null };
  for (const a of items) {
    s.byCategory[a.category] = (s.byCategory[a.category] ?? 0) + a.value;
    if (isLiability(a.category)) s.debtsTotal += a.value;
    else if (isIncomeSource(a.category)) s.incomeSourcesMonthly += a.value;
    else if (a.forRetirement) s.retirementTotal += a.value;
    else s.otherTotal += a.value;
    if (!s.oldestUpdate || a.updatedAt < s.oldestUpdate) s.oldestUpdate = a.updatedAt;
  }
  return s;
}
