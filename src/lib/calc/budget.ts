// Orçamento por envelopes: cada real de renda ganha um destino. Funções puras, valores em centavos.
// Regras (como no orçamento por envelopes clássico):
// - "A distribuir" do mês = sobra do mês anterior + renda do mês − distribuído no mês − estouros do mês anterior.
// - Saldo do envelope = saldo positivo do mês anterior + distribuído + movimento do mês (gastos negativos).
// - Saldo positivo passa para o mês seguinte; saldo negativo (estouro) zera e sai do "a distribuir" do mês seguinte.
// Só contas do dia a dia entram no orçamento. Dinheiro que vai para previdência e investimentos sai pelo
// envelope Aposentadoria; para empréstimos e financiamentos, pelo envelope de dívidas.

import { simulate, type PlanInputs } from './retirement';

export const RETIREMENT_ENVELOPE = 'env-aposentadoria';
export const DEBT_ENVELOPE = 'env-dividas';
export const UNCATEGORIZED_ENVELOPE = 'env-sem-categoria';

export interface BudgetTxInput {
  date: string;   // "YYYY-MM-DD"
  amount: number; // centavos, do ponto de vista da conta do lançamento
  categoryId: string | null;
  categoryKind: 'receita' | 'despesa' | null;
  accountOnBudget: boolean;
  /** Só em transferências: para onde (ou de onde) foi o dinheiro. */
  transfer: { counterpartOnBudget: boolean; counterpartSavings: boolean } | null;
}

export interface MonthActivity {
  income: number;                   // renda do mês, centavos
  activity: Record<string, number>; // movimento por envelope: gastos negativos, estornos positivos
}

/** Classifica os lançamentos em renda e movimento por envelope, mês a mês ("YYYY-MM-01"). */
export function budgetActivity(txs: BudgetTxInput[]): Record<string, MonthActivity> {
  const out: Record<string, MonthActivity> = {};
  for (const t of txs) {
    if (!t.accountOnBudget) continue; // só a perna que mexe numa conta do orçamento
    const month = t.date.slice(0, 8) + '01';
    const m = (out[month] ??= { income: 0, activity: {} });
    const add = (env: string) => (m.activity[env] = (m.activity[env] ?? 0) + t.amount);
    if (t.transfer) {
      if (t.transfer.counterpartOnBudget) continue; // entre contas do orçamento: não muda nada
      add(t.transfer.counterpartSavings ? RETIREMENT_ENVELOPE : DEBT_ENVELOPE);
    } else if (t.categoryKind === 'receita') m.income += t.amount;
    else if (t.categoryKind === 'despesa' && t.categoryId) add(t.categoryId);
    else if (t.amount > 0) m.income += t.amount; // entrada sem categoria conta como renda
    else add(UNCATEGORIZED_ENVELOPE);
  }
  return out;
}

export interface EnvelopeMonth {
  carry: number;    // saldo positivo que veio do mês anterior
  assigned: number; // distribuído neste mês
  activity: number; // movimento do mês
  balance: number;  // carry + assigned + activity
}

export interface BudgetMonth {
  month: string;
  income: number;
  assigned: number;           // total distribuído no mês
  overspentFromPrevious: number;
  toBudget: number;           // "a distribuir": pode ficar negativo se distribuir mais do que tem
  envelopes: Record<string, EnvelopeMonth>;
  overspent: number;          // soma dos estouros deste mês (vai sair do próximo)
}

function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}
export function shiftMonth(month: string, n: number): string {
  const idx = monthIndex(month) + n;
  const y = Math.floor(idx / 12);
  return `${y}-${String(idx - y * 12 + 1).padStart(2, '0')}-01`;
}
/** Meses de `from` até `to`, inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const n = monthIndex(to) - monthIndex(from);
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => shiftMonth(from, i));
}

/**
 * Orçamento de `from` até `to`. `envelopes` são os envelopes a mostrar; outros que tiverem movimento ou
 * distribuição também entram. `assigned[month][envelope]` é o que a pessoa distribuiu.
 */
export function computeBudget(
  envelopes: string[],
  activity: Record<string, MonthActivity>,
  assigned: Record<string, Record<string, number>>,
  from: string,
  to: string,
): BudgetMonth[] {
  const ids = new Set(envelopes);
  for (const m of Object.values(activity)) Object.keys(m.activity).forEach((k) => ids.add(k));
  for (const m of Object.values(assigned)) Object.keys(m).forEach((k) => ids.add(k));
  const out: BudgetMonth[] = [];
  let carryToBudget = 0;
  let overspentPrev = 0;
  let carry: Record<string, number> = {};
  for (const month of monthsBetween(from, to)) {
    const act = activity[month] ?? { income: 0, activity: {} };
    const asg = assigned[month] ?? {};
    const env: Record<string, EnvelopeMonth> = {};
    let assignedTotal = 0;
    let overspent = 0;
    const nextCarry: Record<string, number> = {};
    for (const id of ids) {
      const e = { carry: carry[id] ?? 0, assigned: asg[id] ?? 0, activity: act.activity[id] ?? 0, balance: 0 };
      e.balance = e.carry + e.assigned + e.activity;
      env[id] = e;
      assignedTotal += e.assigned;
      if (e.balance < 0) overspent -= e.balance;
      else nextCarry[id] = e.balance;
    }
    const toBudget = carryToBudget + act.income - assignedTotal - overspentPrev;
    out.push({ month, income: act.income, assigned: assignedTotal, overspentFromPrevious: overspentPrev, toBudget, envelopes: env, overspent });
    carryToBudget = toBudget;
    overspentPrev = overspent;
    carry = nextCarry;
  }
  return out;
}

// ---------- Modelos de meta ----------
export type TemplateKind = 'fixo' | 'ate_data' | 'percentual';

export interface BudgetTemplate {
  envelopeId: string;
  kind: TemplateKind;
  amount: number | null;   // 'fixo': centavos por mês
  target: number | null;   // 'ate_data': centavos a juntar
  deadline: string | null; // 'ate_data': "YYYY-MM-01"
  percent: number | null;  // 'percentual': % da renda do mês (0–100)
}

export function validateTemplate(t: BudgetTemplate): string[] {
  if (t.kind === 'fixo' && !(t.amount && t.amount > 0)) return ['Informe o valor por mês.'];
  if (t.kind === 'ate_data' && !(t.target && t.target > 0)) return ['Informe quanto quer juntar.'];
  if (t.kind === 'ate_data' && !t.deadline) return ['Informe até quando.'];
  if (t.kind === 'percentual' && !(t.percent && t.percent > 0 && t.percent <= 100)) return ['A porcentagem vai de 1 a 100.'];
  return [];
}

/**
 * Quanto o modelo pede para o envelope no mês.
 * 'ate_data' divide o que falta (meta − saldo que veio do mês anterior) pelos meses que restam até o prazo,
 * contando o mês atual; com o prazo vencido, pede tudo o que falta de uma vez.
 */
export function templateAmount(t: BudgetTemplate, month: string, carry: number, income: number): number {
  if (t.kind === 'fixo') return t.amount ?? 0;
  if (t.kind === 'percentual') return Math.round((Math.max(income, 0) * (t.percent ?? 0)) / 100);
  const remaining = Math.max((t.target ?? 0) - carry, 0);
  const monthsLeft = Math.max(monthIndex(t.deadline ?? month) - monthIndex(month) + 1, 1);
  return Math.ceil(remaining / monthsLeft);
}

/** Progresso da meta de um envelope 'ate_data': saldo ÷ meta, entre 0 e 1. */
export function templateProgress(t: BudgetTemplate, balance: number): number | null {
  if (t.kind !== 'ate_data' || !t.target) return null;
  return Math.min(Math.max(balance / t.target, 0), 1);
}

// ---------- Envelope Aposentadoria x plano ----------
export interface RetirementImpact {
  budgetedMonthly: number;            // reais por mês, o que está no envelope
  requiredMonthly: number;            // reais por mês que o plano pede (central, sem INSS)
  coverageWithBudget: number;         // cobertura da renda desejada se aportar o orçado
  sustainableIncomeWithBudget: number; // renda mensal que o orçado sustentaria
  sustainableIncomeWithPlan: number;   // a mesma renda com o aporte informado no plano
}

/** O que acontece com a aposentadoria se o aporte for o valor orçado no envelope (cenário central, sem INSS). */
export function retirementImpact(inputs: PlanInputs, budgetedCents: number): RetirementImpact {
  const budgetedMonthly = Math.max(budgetedCents, 0) / 100;
  const withBudget = simulate({ ...inputs, monthlyContribution: budgetedMonthly }, 'central', false);
  const withPlan = simulate(inputs, 'central', false);
  return {
    budgetedMonthly,
    requiredMonthly: withPlan.requiredMonthlyContribution,
    coverageWithBudget: withBudget.coverageRatio,
    sustainableIncomeWithBudget: withBudget.sustainableMonthlyIncome,
    sustainableIncomeWithPlan: withPlan.sustainableMonthlyIncome,
  };
}
