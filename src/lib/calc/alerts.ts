// Avisos do dia a dia: envelope chegando no limite, cobrança repetida, preço que mudou e gasto acima da média.
// Funções puras, valores em centavos. Cada aviso traz uma chave estável (para "ignorar") e os ids da evidência.

import { DEBT_ENVELOPE, RETIREMENT_ENVELOPE, shiftMonth, type EnvelopeMonth } from './budget';
import { normalize } from './categorize';

// ---------- Orçamento: quanto do envelope já foi gasto ----------
export type BudgetAlertLevel = 'atencao' | 'limite';

export type BudgetAlert = {
  envelopeId: string;
  level: BudgetAlertLevel;
  pct: number;       // gasto ÷ disponível no mês (carry + distribuído); pode passar de 1
  spent: number;     // centavos positivos
  available: number; // carry + distribuído, centavos
}

/** Aviso a partir de 75% do envelope; "limite" quando o gasto chega ou passa do que havia. */
export const BUDGET_WARN_AT = 0.75;

export function budgetAlertLevel(available: number, spent: number, warnAt = BUDGET_WARN_AT): BudgetAlertLevel | null {
  if (available <= 0 || spent <= 0) return null;
  const pct = spent / available;
  return pct >= 1 ? 'limite' : pct >= warnAt ? 'atencao' : null;
}

/**
 * Envelopes de gasto com aviso. Aposentadoria e dívidas ficam de fora (sair dinheiro deles é o objetivo).
 * Envelope sem dinheiro distribuído não tem limite para comparar e não gera aviso aqui.
 */
export function budgetAlerts(envelopes: Record<string, EnvelopeMonth>, warnAt = BUDGET_WARN_AT): BudgetAlert[] {
  const out: BudgetAlert[] = [];
  for (const [envelopeId, e] of Object.entries(envelopes)) {
    if (envelopeId === RETIREMENT_ENVELOPE || envelopeId === DEBT_ENVELOPE) continue;
    const available = e.carry + e.assigned;
    const spent = Math.max(-e.activity, 0);
    const level = budgetAlertLevel(available, spent, warnAt);
    if (level) out.push({ envelopeId, level, pct: spent / available, spent, available });
  }
  return out.sort((a, b) => b.pct - a.pct);
}

/** O lançamento fez o envelope mudar de nível (nada → atenção → limite)? Devolve o novo nível, ou null. */
export function budgetAlertCrossed(before: BudgetAlertLevel | null, after: BudgetAlertLevel | null): BudgetAlertLevel | null {
  const rank = (l: BudgetAlertLevel | null) => (l === 'limite' ? 2 : l === 'atencao' ? 1 : 0);
  return rank(after) > rank(before) ? after : null;
}

// ---------- Anomalias nos lançamentos ----------
export type AnomalyTx = {
  id: string;
  accountId: string;
  date: string;   // "YYYY-MM-DD"
  amount: number; // centavos, com sinal
  payee: string;
  categoryId: string | null;
  transferId: string | null;
  /** Lançamento gerado por recorrência ou parcela: repetir é esperado. */
  scheduled: boolean;
}

export type DuplicateCharge = { kind: 'duplicado'; key: string; ids: string[]; payee: string; amount: number; dates: string[] };
export type PriceChange = { kind: 'preco'; key: string; ids: string[]; payee: string; before: number; after: number; date: string };
export type AboveAverage = { kind: 'acima_media'; key: string; group: string; month: string; current: number; average: number; pct: number };
export type Anomaly = DuplicateCharge | PriceChange | AboveAverage;

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
const isPlainOutflow = (t: AnomalyTx) => t.amount < 0 && !t.transferId && !t.scheduled;

/**
 * Mesma saída lançada duas vezes: mesma conta, mesmo valor e mesma descrição em até `windowDays` dias.
 * Só olha lançamentos a partir de `since`. Recorrências e parcelas ficam de fora.
 */
export function duplicateCharges(txs: AnomalyTx[], since: string, windowDays = 3): DuplicateCharge[] {
  const groups = new Map<string, AnomalyTx[]>();
  for (const t of txs) {
    if (!isPlainOutflow(t) || t.date < since) continue;
    const k = `${t.accountId}|${t.amount}|${normalize(t.payee)}`;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const out: DuplicateCharge[] = [];
  for (const list of groups.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1]!;
      const b = list[i]!;
      if (dayDiff(a.date, b.date) > windowDays) continue;
      out.push({ kind: 'duplicado', key: `duplicado:${a.id}:${b.id}`, ids: [a.id, b.id], payee: b.payee, amount: -b.amount, dates: [a.date, b.date] });
      i++; // um par por vez: três iguais seguidos viram um aviso, não dois sobrepostos
    }
  }
  return out.sort((x, y) => y.dates[1]!.localeCompare(x.dates[1]!));
}

/**
 * Cobrança que se repete todo mês (uma por mês, em pelo menos `minMonths` meses seguidos) e mudou de valor
 * em mais de `tolerance` na última vez. Ex.: streaming de 39,90 para 55,90. Só avisa se a última for desde `since`.
 */
export function priceChanges(txs: AnomalyTx[], since: string, minMonths = 3, tolerance = 0.05): PriceChange[] {
  const byPayee = new Map<string, AnomalyTx[]>();
  for (const t of txs) {
    if (t.amount >= 0 || t.transferId) continue; // recorrências entram: é justamente onde o preço muda
    const k = normalize(t.payee);
    if (k) byPayee.set(k, [...(byPayee.get(k) ?? []), t]);
  }
  const out: PriceChange[] = [];
  for (const list of byPayee.values()) {
    const byMonth = new Map<string, AnomalyTx[]>();
    for (const t of list) byMonth.set(t.date.slice(0, 7), [...(byMonth.get(t.date.slice(0, 7)) ?? []), t]);
    if ([...byMonth.values()].some((m) => m.length > 1)) continue; // mais de uma por mês: não é assinatura
    const months = [...byMonth.keys()].sort();
    // A sequência que termina no último mês precisa ser de meses seguidos.
    let run = 1;
    for (let i = months.length - 1; i > 0; i--) {
      if (shiftMonth(months[i - 1]! + '-01', 1) !== months[i]! + '-01') break;
      run++;
    }
    if (run < minMonths) continue;
    const last = byMonth.get(months.at(-1) ?? "")?.[0];
    const prev = byMonth.get(months.at(-2) ?? "")?.[0];
    if (!last || !prev || last.date < since) continue;
    const before = -prev.amount;
    const after = -last.amount;
    if (Math.abs(after - before) / before <= tolerance) continue;
    out.push({ kind: 'preco', key: `preco:${prev.id}:${last.id}`, ids: [prev.id, last.id], payee: last.payee, before, after, date: last.date });
  }
  return out;
}

export type SpendItem = {
  group: string;  // categoria ou conta (ex.: "conta:<id>" para a fatura do cartão)
  date: string;
  amount: number; // centavos, com sinal; saídas negativas, estornos positivos
}

/**
 * Grupos cujo gasto em `month` passou da média dos `months` meses anteriores em mais de `pct`
 * (e em pelo menos `minDelta` centavos, para não avisar por troco). Só compara quem gastou em todos esses meses.
 */
export function aboveAverage(items: SpendItem[], month: string, months = 3, pct = 0.15, minDelta = 5000): AboveAverage[] {
  const window = Array.from({ length: months }, (_, i) => shiftMonth(month, -(i + 1)).slice(0, 7));
  const cur = month.slice(0, 7);
  const totals = new Map<string, Map<string, number>>();
  for (const it of items) {
    const m = it.date.slice(0, 7);
    if (m !== cur && !window.includes(m)) continue;
    const g = totals.get(it.group) ?? new Map<string, number>();
    g.set(m, (g.get(m) ?? 0) - it.amount);
    totals.set(it.group, g);
  }
  const out: AboveAverage[] = [];
  for (const [group, byMonth] of totals) {
    const past = window.map((m) => byMonth.get(m) ?? 0);
    if (past.some((v) => v <= 0)) continue;
    const average = past.reduce((a, v) => a + v, 0) / months;
    const current = byMonth.get(cur) ?? 0;
    if (current - average < minDelta || current <= average * (1 + pct)) continue;
    out.push({ kind: 'acima_media', key: `acima_media:${group}:${cur}`, group, month: cur + '-01', current, average: Math.round(average), pct: current / average - 1 });
  }
  return out.sort((a, b) => b.pct - a.pct);
}
