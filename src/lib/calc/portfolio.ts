// Carteira de investimentos: posições pelo preço médio, ganhos, alocação por classe, XIRR e
// a divisão do aporte do mês entre as classes. Funções puras. Dinheiro em centavos; quantidades podem ter fração.

import type { AssetCategory } from './assets';

export type AssetClass = 'previdencia' | 'renda_fixa' | 'acoes' | 'fiis' | 'exterior' | 'cripto' | 'outros';

export const ASSET_CLASSES: { key: AssetClass; label: string }[] = [
  { key: 'previdencia', label: 'Previdência' },
  { key: 'renda_fixa', label: 'Renda fixa' },
  { key: 'acoes', label: 'Ações' },
  { key: 'fiis', label: 'Fundos imobiliários' },
  { key: 'exterior', label: 'Exterior' },
  { key: 'cripto', label: 'Cripto' },
  { key: 'outros', label: 'Outros' },
];
export const assetClassLabel = (c: AssetClass) => ASSET_CLASSES.find((x) => x.key === c)?.label ?? c;

/** Itens do Patrimônio que podem ter posições. */
export const holdsPositions = (c: AssetCategory) => c === 'investimentos' || c === 'pgbl' || c === 'vgbl' || c === 'outro';
/** Classe de um item do Patrimônio sem posições, para a alocação. */
export const classOfCategory = (c: AssetCategory): AssetClass => (c === 'pgbl' || c === 'vgbl' ? 'previdencia' : 'outros');

export type TradeType = 'compra' | 'venda' | 'provento';

export type Trade = {
  id: string;
  date: string;      // "YYYY-MM-DD"
  type: TradeType;
  quantity: number;  // unidades (compra/venda); 0 em provento
  unitPrice: number; // centavos por unidade (compra/venda); em provento, o valor total recebido
  fees: number;      // centavos
}

export type Position = {
  quantity: number;
  costBasis: number;  // centavos ainda investidos (quantidade × preço médio)
  avgPrice: number;   // centavos por unidade
  realized: number;   // ganho realizado nas vendas, centavos
  income: number;     // proventos recebidos, centavos
  invested: number;   // total comprado, com taxas
  oversold: boolean;  // alguma venda passou da quantidade em carteira
}

const EPS = 1e-9;
const tradeOrder: Record<TradeType, number> = { compra: 0, provento: 1, venda: 2 };

/**
 * Posição pelo preço médio ponderado.
 * Compra: soma quantidade e custo (preço × quantidade + taxas). Venda: realiza (preço × quantidade − taxas) − quantidade × preço médio.
 * No mesmo dia, compras vêm antes das vendas.
 */
export function positionFromTrades(trades: Trade[]): Position {
  const p: Position = { quantity: 0, costBasis: 0, avgPrice: 0, realized: 0, income: 0, invested: 0, oversold: false };
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date) || tradeOrder[a.type] - tradeOrder[b.type]);
  for (const t of sorted) {
    if (t.type === 'provento') {
      p.income += t.unitPrice - t.fees;
      continue;
    }
    if (t.type === 'compra') {
      const cost = t.quantity * t.unitPrice + t.fees;
      p.quantity += t.quantity;
      p.costBasis += cost;
      p.invested += cost;
    } else {
      const qty = Math.min(t.quantity, p.quantity);
      if (t.quantity > p.quantity + EPS) p.oversold = true;
      const avg = p.quantity > EPS ? p.costBasis / p.quantity : 0;
      p.realized += qty * t.unitPrice - t.fees - qty * avg;
      p.costBasis -= qty * avg;
      p.quantity -= qty;
    }
    if (p.quantity < EPS) {
      p.quantity = 0;
      p.costBasis = 0;
    }
    p.avgPrice = p.quantity > 0 ? p.costBasis / p.quantity : 0;
  }
  p.costBasis = Math.round(p.costBasis);
  p.realized = Math.round(p.realized);
  p.avgPrice = Math.round(p.avgPrice);
  return p;
}

export type Valued = {
  marketValue: number; // centavos
  unrealized: number;  // valor de mercado − custo
  unrealizedPct: number | null;
} & Position

export function valuePosition(p: Position, price: number): Valued {
  const marketValue = Math.round(p.quantity * price);
  const unrealized = marketValue - p.costBasis;
  return { ...p, marketValue, unrealized, unrealizedPct: p.costBasis > 0 ? unrealized / p.costBasis : null };
}

export type ClassShare = {
  assetClass: AssetClass;
  value: number;        // centavos
  share: number;        // fração da carteira
  target: number | null; // fração-alvo
}

/** Valor e fração por classe, com a meta de cada uma (metas em %, somando 100). */
export function allocation(items: { assetClass: AssetClass; value: number }[], targets: Partial<Record<AssetClass, number>> = {}): ClassShare[] {
  const byClass = new Map<AssetClass, number>();
  for (const i of items) byClass.set(i.assetClass, (byClass.get(i.assetClass) ?? 0) + i.value);
  for (const k of Object.keys(targets) as AssetClass[]) if ((targets[k] ?? 0) > 0 && !byClass.has(k)) byClass.set(k, 0);
  const total = [...byClass.values()].reduce((a, v) => a + v, 0);
  return ASSET_CLASSES.filter((c) => byClass.has(c.key)).map((c) => ({
    assetClass: c.key,
    value: byClass.get(c.key)!,
    share: total > 0 ? byClass.get(c.key)! / total : 0,
    target: targets[c.key] != null ? targets[c.key]! / 100 : null,
  }));
}

export function validateTargets(targets: Partial<Record<AssetClass, number>>): string[] {
  const values = Object.values(targets).filter((v): v is number => v != null);
  if (values.some((v) => !(Number.isFinite(v) && v >= 0 && v <= 100))) return ['Cada meta vai de 0% a 100%.'];
  const sum = values.reduce((a, v) => a + v, 0);
  if (Math.abs(sum - 100) > 0.01) return [`As metas somam ${sum.toLocaleString('pt-BR')}%; precisam somar 100%.`];
  return [];
}

export type Suggestion = {
  assetClass: AssetClass;
  amount: number;      // centavos a aportar
  before: number;      // fração antes
  after: number;       // fração depois
  target: number;      // fração-alvo
}

/**
 * Divide o aporte entre as classes, só comprando, para chegar o mais perto das metas
 * (menor soma dos quadrados das diferenças). A solução é "encher pelo fundo": cada classe recebe
 * max(falta − λ, 0), com λ escolhido para a soma dar o aporte. Centavos de arredondamento vão para a classe mais abaixo da meta.
 */
export function allocateContribution(current: Partial<Record<AssetClass, number>>, targets: Partial<Record<AssetClass, number>>, amount: number): Suggestion[] {
  const classes = ASSET_CLASSES.map((c) => c.key).filter((k) => (targets[k] ?? 0) > 0 || (current[k] ?? 0) > 0);
  const totalNow = classes.reduce((a, k) => a + (current[k] ?? 0), 0);
  const totalAfter = totalNow + Math.max(amount, 0);
  const w = (k: AssetClass) => (targets[k] ?? 0) / 100;
  const gap = new Map(classes.map((k) => [k, w(k) * totalAfter - (current[k] ?? 0)]));
  // λ: procura entre as faltas ordenadas, de cima para baixo.
  const sorted = [...gap.values()].sort((a, b) => b - a);
  let lambda = 0;
  for (let i = 0; i < sorted.length; i++) {
    const head = sorted.slice(0, i + 1);
    const l = (head.reduce((a, v) => a + v, 0) - amount) / head.length;
    if (i === sorted.length - 1 || l >= sorted[i + 1]!) {
      lambda = l;
      break;
    }
  }
  const raw = classes.map((k) => ({ k, x: Math.max(gap.get(k)! - lambda, 0) }));
  const rounded = raw.map((r) => ({ ...r, x: Math.floor(r.x) }));
  let rest = Math.max(amount, 0) - rounded.reduce((a, r) => a + r.x, 0);
  const order = [...rounded].sort((a, b) => gap.get(b.k)! - gap.get(a.k)!);
  for (let i = 0; rest > 0 && order.length; i = (i + 1) % order.length, rest--) order[i]!.x++;
  return rounded
    .filter((r) => r.x > 0)
    .map((r) => ({
      assetClass: r.k,
      amount: r.x,
      before: totalNow > 0 ? (current[r.k] ?? 0) / totalNow : 0,
      after: totalAfter > 0 ? ((current[r.k] ?? 0) + r.x) / totalAfter : 0,
      target: w(r.k),
    }))
    .sort((a, b) => b.amount - a.amount);
}

// ---------- XIRR ----------
export type CashFlow = {
  date: string;   // "YYYY-MM-DD"
  amount: number; // saída para comprar negativa; vendas, proventos e o valor de hoje positivos
}

const years = (a: string, b: string) => (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / (365 * 86400000);

/**
 * Taxa anual que zera o valor presente dos fluxos: Σ CF / (1 + r)^(dias/365) = 0.
 * Newton com recuo para bisseção. Sem saída e entrada, ou com menos de 30 dias de histórico, devolve null.
 */
export function xirr(flows: CashFlow[]): number | null {
  if (flows.length < 2 || !flows.some((f) => f.amount < 0) || !flows.some((f) => f.amount > 0)) return null;
  const t0 = flows.reduce((m, f) => (f.date < m ? f.date : m), flows[0]!.date);
  const tEnd = flows.reduce((m, f) => (f.date > m ? f.date : m), flows[0]!.date);
  if (years(t0, tEnd) * 365 < 30) return null;
  const npv = (r: number) => flows.reduce((a, f) => a + f.amount / Math.pow(1 + r, years(t0, f.date)), 0);
  const dnpv = (r: number) => flows.reduce((a, f) => a - (years(t0, f.date) * f.amount) / Math.pow(1 + r, years(t0, f.date) + 1), 0);
  let r = 0.1;
  for (let i = 0; i < 50; i++) {
    const f = npv(r);
    const d = dnpv(r);
    if (!Number.isFinite(f) || !Number.isFinite(d) || d === 0) break;
    const next = r - f / d;
    if (next <= -0.999) break;
    if (Math.abs(next - r) < 1e-10) return next;
    r = next;
  }
  // Bisseção entre −99,9% e 1000% ao ano.
  let lo = -0.999;
  let hi = 10;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (npv(lo) * npv(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

export type ReturnSummary = {
  rate: number;    // anual se houver um ano ou mais de histórico; senão, acumulada no período
  annual: boolean;
  years: number;   // tamanho do histórico
}

/**
 * Rentabilidade para mostrar. Anualizar poucos meses exagera (4% em dois meses vira ~26% ao ano),
 * então com menos de um ano mostra o acumulado no período: (1 + XIRR)^anos − 1.
 */
export function returnSummary(flows: CashFlow[]): ReturnSummary | null {
  const r = xirr(flows);
  if (r === null) return null;
  const dates = flows.map((f) => f.date).sort();
  const span = years(dates[0]!, dates[dates.length - 1]!);
  return span >= 1 ? { rate: r, annual: true, years: span } : { rate: Math.pow(1 + r, span) - 1, annual: false, years: span };
}

/** Fluxos de uma carteira para o XIRR: compras saem, vendas e proventos entram, e o valor de hoje fecha a conta. */
export function tradeFlows(trades: Trade[], marketValue: number, today: string): CashFlow[] {
  const flows: CashFlow[] = trades.map((t) => ({
    date: t.date,
    amount: t.type === 'compra' ? -(t.quantity * t.unitPrice + t.fees) : t.type === 'venda' ? t.quantity * t.unitPrice - t.fees : t.unitPrice - t.fees,
  }));
  if (marketValue > 0) flows.push({ date: today, amount: marketValue });
  return flows;
}
