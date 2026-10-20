import { describe, it, expect } from 'vitest';
import {
  budgetActivity,
  computeBudget,
  DEBT_ENVELOPE,
  monthsBetween,
  retirementImpact,
  RETIREMENT_ENVELOPE,
  templateAmount,
  templateProgress,
  UNCATEGORIZED_ENVELOPE,
  validateTemplate,
  type BudgetTemplate,
  type BudgetTxInput,
} from './budget';
import type { PlanInputs } from './retirement';

const t = (date: string, amount: number, extra: Partial<BudgetTxInput> = {}): BudgetTxInput => ({
  date, amount, categoryId: null, categoryKind: null, accountOnBudget: true, transfer: null, ...extra,
});

describe('o que entra e sai do orçamento', () => {
  it('classifica renda, gastos, estornos, transferências e contas fora do orçamento', () => {
    const a = budgetActivity([
      t('2026-10-05', 800000, { categoryId: 'renda', categoryKind: 'receita' }),
      t('2026-10-07', -50000, { categoryId: 'mercado', categoryKind: 'despesa' }),
      t('2026-10-08', 5000, { categoryId: 'mercado', categoryKind: 'despesa' }),
      t('2026-10-09', -3000),
      t('2026-10-09', 1000),
      t('2026-10-10', -100000, { transfer: { counterpartOnBudget: false, counterpartSavings: true } }),
      t('2026-10-11', -70000, { transfer: { counterpartOnBudget: false, counterpartSavings: false } }),
      t('2026-10-12', -20000, { transfer: { counterpartOnBudget: true, counterpartSavings: false } }),
      t('2026-10-10', 100000, { accountOnBudget: false, transfer: { counterpartOnBudget: true, counterpartSavings: false } }),
      t('2026-10-15', 3000, { accountOnBudget: false, categoryKind: 'receita' }),
    ]);
    expect(a).toEqual({
      '2026-10-01': {
        income: 801000,
        activity: { mercado: -45000, [UNCATEGORIZED_ENVELOPE]: -3000, [RETIREMENT_ENVELOPE]: -100000, [DEBT_ENVELOPE]: -70000 },
      },
    });
  });
});

describe('envelopes', () => {
  it('saldo positivo passa para o mês seguinte; estouro zera e sai do "a distribuir" do mês seguinte', () => {
    const activity = {
      '2026-09-01': { income: 500000, activity: { mercado: -60000, lazer: -10000 } },
      '2026-10-01': { income: 500000, activity: { mercado: -20000 } },
    };
    const assigned = {
      '2026-09-01': { mercado: 50000, lazer: 30000 },
      '2026-10-01': { mercado: 50000 },
    };
    const [sep, oct] = computeBudget(['mercado', 'lazer'], activity, assigned, '2026-09-01', '2026-10-01');
    expect(sep!.envelopes['mercado']!.balance).toBe(-10000);
    expect(sep!.envelopes['lazer']!.balance).toBe(20000);
    expect(sep!.toBudget).toBe(500000 - 80000);
    expect(sep!.overspent).toBe(10000);
    expect(oct!.envelopes['mercado']).toEqual({ carry: 0, assigned: 50000, activity: -20000, balance: 30000 });
    expect(oct!.envelopes['lazer']).toEqual({ carry: 20000, assigned: 0, activity: 0, balance: 20000 });
    expect(oct!.overspentFromPrevious).toBe(10000);
    expect(oct!.toBudget).toBe(420000 + 500000 - 50000 - 10000);
  });

  it('distribuir mais do que tem deixa o "a distribuir" negativo', () => {
    const [m] = computeBudget(['x'], { '2026-10-01': { income: 1000, activity: {} } }, { '2026-10-01': { x: 3000 } }, '2026-10-01', '2026-10-01');
    expect(m!.toBudget).toBe(-2000);
  });

  it('meses entre duas datas, virando o ano', () => {
    expect(monthsBetween('2026-11-01', '2027-02-01')).toEqual(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01']);
    expect(monthsBetween('2027-02-01', '2026-11-01')).toEqual([]);
  });
});

describe('modelos de meta', () => {
  const base: BudgetTemplate = { envelopeId: 'x', kind: 'fixo', amount: 50000, target: null, deadline: null, percent: null };

  it('valor fixo e porcentagem da renda', () => {
    expect(templateAmount(base, '2026-10-01', 0, 0)).toBe(50000);
    expect(templateAmount({ ...base, kind: 'percentual', percent: 10 }, '2026-10-01', 0, 812345)).toBe(81235);
  });

  it('até uma data: divide o que falta pelos meses que restam, contando o atual', () => {
    const viagem: BudgetTemplate = { ...base, kind: 'ate_data', target: 600000, deadline: '2027-03-01' };
    expect(templateAmount(viagem, '2026-10-01', 0, 0)).toBe(100000); // 6 meses: out a mar
    expect(templateAmount(viagem, '2026-10-01', 150000, 0)).toBe(75000);
    expect(templateAmount(viagem, '2027-05-01', 500000, 0)).toBe(100000); // prazo vencido: o que falta
    expect(templateAmount(viagem, '2026-10-01', 700000, 0)).toBe(0);
    expect(templateProgress(viagem, 150000)).toBe(0.25);
    expect(templateProgress(base, 1)).toBeNull();
  });

  it('valida', () => {
    expect(validateTemplate(base)).toEqual([]);
    expect(validateTemplate({ ...base, amount: 0 })).toHaveLength(1);
    expect(validateTemplate({ ...base, kind: 'ate_data', target: 1 })).toHaveLength(1);
    expect(validateTemplate({ ...base, kind: 'percentual', percent: 120 })).toHaveLength(1);
  });
});

describe('envelope Aposentadoria x plano', () => {
  const inputs: PlanInputs = {
    currentAge: 30, retirementAge: 60, horizonAge: 95, initialWealth: 10000, monthlyContribution: 1000,
    desiredMonthlyIncome: 8000, inssEstimate: 4500,
    returns: { conservador: 0.02, central: 0.04, otimista: 0.06 }, inflationAA: 0.04, costsAA: 0,
  };

  it('orçar o mesmo que o plano dá a mesma renda; orçar mais, renda maior', () => {
    const same = retirementImpact(inputs, 100000);
    expect(same.sustainableIncomeWithBudget).toBeCloseTo(same.sustainableIncomeWithPlan, 6);
    const more = retirementImpact(inputs, 200000);
    expect(more.sustainableIncomeWithBudget).toBeGreaterThan(same.sustainableIncomeWithPlan);
    expect(more.coverageWithBudget).toBeGreaterThan(same.coverageWithBudget);
    expect(retirementImpact(inputs, -5).budgetedMonthly).toBe(0);
  });
});
