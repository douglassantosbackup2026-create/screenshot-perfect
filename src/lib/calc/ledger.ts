// Livro-caixa: contas, saldos e totais do mês. Funções puras.
// Valores em centavos (inteiros), com sinal: entrada positiva, saída negativa.
// Transferências entre contas mexem nos saldos, mas não contam como receita nem despesa.

export type AccountKind = 'corrente' | 'poupanca' | 'carteira' | 'cartao' | 'investimento' | 'previdencia' | 'emprestimo';
export type AccountGroup = 'dia_a_dia' | 'investimentos' | 'dividas';

export const ACCOUNT_KINDS: { key: AccountKind; label: string; group: AccountGroup }[] = [
  { key: 'corrente', label: 'Conta corrente', group: 'dia_a_dia' },
  { key: 'poupanca', label: 'Poupança', group: 'dia_a_dia' },
  { key: 'carteira', label: 'Dinheiro', group: 'dia_a_dia' },
  { key: 'investimento', label: 'Corretora ou investimentos', group: 'investimentos' },
  { key: 'previdencia', label: 'Previdência', group: 'investimentos' },
  { key: 'cartao', label: 'Cartão de crédito', group: 'dividas' },
  { key: 'emprestimo', label: 'Empréstimo ou financiamento', group: 'dividas' },
];

export const accountKindLabel = (k: AccountKind) => ACCOUNT_KINDS.find((x) => x.key === k)?.label ?? k;
export const accountGroup = (k: AccountKind): AccountGroup => ACCOUNT_KINDS.find((x) => x.key === k)?.group ?? 'dia_a_dia';
/** Contas para onde vai o dinheiro guardado para o futuro: uma transferência para elas pode virar aporte. */
export const isSavingsAccount = (k: AccountKind) => accountGroup(k) === 'investimentos';
/** Contas do orçamento: o dinheiro do dia a dia, inclusive o cartão. Previdência, investimentos e empréstimos ficam fora. */
export const isOnBudget = (k: AccountKind) => k === 'corrente' || k === 'poupanca' || k === 'carteira' || k === 'cartao';

export type LedgerAccount = {
  id: string;
  openingBalance: number; // centavos
}

export type LedgerTx = {
  id: string;
  accountId: string;
  date: string; // "YYYY-MM-DD"
  amount: number; // centavos, com sinal
  categoryId: string | null;
  transferId: string | null;
}

/** Reais para centavos, sem erro de ponto flutuante. */
export const toCents = (reais: number) => Math.round(reais * 100);
export const fromCents = (cents: number) => cents / 100;

/** Saldo de cada conta: saldo inicial + lançamentos até `until` (inclusive). Sem `until`, todos. */
export function accountBalances(accounts: LedgerAccount[], txs: LedgerTx[], until?: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of accounts) out[a.id] = a.openingBalance;
  for (const t of txs) {
    if (until && t.date > until) continue;
    const current = out[t.accountId];
    if (current !== undefined) out[t.accountId] = current + t.amount;
  }
  return out;
}

const inMonth = (date: string, month: string) => date.slice(0, 7) === month.slice(0, 7);

export type MonthSummary = {
  income: number;  // entradas, centavos positivos
  expense: number; // saídas, centavos positivos
  net: number;     // entradas − saídas
  count: number;   // lançamentos do mês, sem transferências
}

/** Entradas e saídas do mês, sem transferências. `month` é "YYYY-MM-01". */
export function monthSummary(txs: LedgerTx[], month: string): MonthSummary {
  const s: MonthSummary = { income: 0, expense: 0, net: 0, count: 0 };
  for (const t of txs) {
    if (t.transferId || !inMonth(t.date, month)) continue;
    if (t.amount >= 0) s.income += t.amount;
    else s.expense -= t.amount;
    s.count++;
  }
  s.net = s.income - s.expense;
  return s;
}

export type CategoryShare = {
  categoryId: string | null; // null = sem categoria
  amount: number;            // centavos positivos
  share: number;             // fração do total, soma 1
}

/** Gastos do mês por categoria, do maior para o menor. Estornos (entradas na categoria) abatem o gasto. */
export function spendingByCategory(txs: LedgerTx[], month: string): CategoryShare[] {
  const totals = new Map<string | null, number>();
  for (const t of txs) {
    if (t.transferId || !inMonth(t.date, month)) continue;
    if (t.amount >= 0 && t.categoryId === null) continue; // entradas sem categoria não são estorno
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) - t.amount);
  }
  const positive = [...totals.entries()].filter(([, v]) => v > 0);
  const total = positive.reduce((a, [, v]) => a + v, 0);
  if (total <= 0) return [];
  return positive.map(([categoryId, amount]) => ({ categoryId, amount, share: amount / total })).sort((a, b) => b.amount - a.amount);
}

export type DayGroup<T extends LedgerTx> = {
  date: string;
  items: T[];
  net: number; // soma do dia, sem transferências
}

/** Lançamentos agrupados por dia, do mais recente para o mais antigo. */
export function groupByDay<T extends LedgerTx>(txs: T[]): DayGroup<T>[] {
  const byDay = new Map<string, T[]>();
  for (const t of txs) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]);
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({ date, items, net: items.filter((t) => !t.transferId).reduce((a, t) => a + t.amount, 0) }));
}
