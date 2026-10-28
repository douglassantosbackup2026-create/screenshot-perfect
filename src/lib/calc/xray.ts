// Raio-X do patrimônio: concentração, liquidez e o que falta nos dados, com o que olhar primeiro.
// Função pura. Devolve códigos e números; o texto de cada problema fica na tela.

import type { AssetCategory } from './assets';

export type XrayItem = {
  id: string;
  name: string;
  category: AssetCategory;
  value: number;     // R$
  updatedAt: string; // ISO
  rateMonthly?: number | null;
}

/** Viram dinheiro em até 30 dias, em geral. Previdência, imóvel e "outro" não contam. */
const LIQUID: ReadonlySet<AssetCategory> = new Set(['reserva', 'investimentos']);
export const STALE_DAYS = 90;
export const CONCENTRATION_LIMIT = 0.6;
export const DEBT_RATIO_LIMIT = 0.5;

export type XrayIssueCode = 'endividado' | 'sem_reserva' | 'divida_sem_juros' | 'concentrado' | 'desatualizado';

export type XrayIssue = {
  code: XrayIssueCode;
  severity: 1 | 2 | 3; // 3 = olhar primeiro
  ids: string[];       // itens que são a evidência (vazio quando o problema é do conjunto)
  value: number;       // número que explica o problema (fração ou contagem)
}

export type Xray = {
  assetsTotal: number;
  debtsTotal: number;
  hhi: number | null;     // 1 = tudo num item; quanto menor, mais espalhado
  largest: { id: string; name: string; share: number } | null;
  liquidShare: number | null; // fração dos ativos que vira dinheiro em 30 dias
  issues: XrayIssue[];    // do mais grave para o menos grave
  actions: XrayIssue[];   // os 3 primeiros: "o que fazer agora"
}

/**
 * `reservePct` é quanto da reserva de emergência já está guardado (0 a 1), ou null se não dá para saber
 * (sem histórico de gastos). Benefícios (renda mensal) não entram em nenhuma conta.
 */
export function wealthXray(items: XrayItem[], reservePct: number | null, now: Date): Xray {
  const assets = items.filter((i) => i.category !== 'divida' && i.category !== 'beneficio' && i.value > 0);
  const debts = items.filter((i) => i.category === 'divida');
  const assetsTotal = assets.reduce((t, i) => t + i.value, 0);
  const debtsTotal = debts.reduce((t, i) => t + i.value, 0);

  let hhi: number | null = null;
  let largest: Xray['largest'] = null;
  let liquidShare: number | null = null;
  if (assetsTotal > 0) {
    hhi = assets.reduce((t, i) => t + (i.value / assetsTotal) ** 2, 0);
    const top = assets.reduce((a, b) => (b.value > a.value ? b : a));
    largest = { id: top.id, name: top.name, share: top.value / assetsTotal };
    liquidShare = assets.filter((i) => LIQUID.has(i.category)).reduce((t, i) => t + i.value, 0) / assetsTotal;
  }

  const issues: XrayIssue[] = [];
  if (debtsTotal > 0 && (assetsTotal === 0 || debtsTotal / assetsTotal > DEBT_RATIO_LIMIT))
    issues.push({ code: 'endividado', severity: 3, ids: debts.map((d) => d.id), value: assetsTotal ? debtsTotal / assetsTotal : 1 });
  if (reservePct !== null && reservePct < 1) issues.push({ code: 'sem_reserva', severity: 3, ids: [], value: reservePct });
  const noRate = debts.filter((d) => d.rateMonthly == null);
  if (noRate.length) issues.push({ code: 'divida_sem_juros', severity: 2, ids: noRate.map((d) => d.id), value: noRate.length });
  if (largest && assets.length > 1 && largest.share > CONCENTRATION_LIMIT)
    issues.push({ code: 'concentrado', severity: 2, ids: [largest.id], value: largest.share });
  const cutoff = now.getTime() - STALE_DAYS * 86400000;
  const stale = items.filter((i) => new Date(i.updatedAt).getTime() < cutoff);
  if (stale.length) issues.push({ code: 'desatualizado', severity: 1, ids: stale.map((i) => i.id), value: stale.length });

  issues.sort((a, b) => b.severity - a.severity);
  return { assetsTotal, debtsTotal, hhi, largest, liquidShare, issues, actions: issues.slice(0, 3) };
}
