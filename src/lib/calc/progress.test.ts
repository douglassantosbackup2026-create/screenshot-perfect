import { describe, it, expect } from 'vitest';
import {
  contributionsByDestination,
  fiProgress,
  goalProgress,
  monthlyContributionSeries,
  projectMonthlyPath,
  selfComparison,
  wealthTimeline,
} from './progress';
import type { PlanInputs } from './retirement';

const base: PlanInputs = {
  currentAge: 30, retirementAge: 60, horizonAge: 95, initialWealth: 10000, monthlyContribution: 1000,
  desiredMonthlyIncome: 8000, inssEstimate: 4500,
  returns: { conservador: 0.02, central: 0.04, otimista: 0.06 }, inflationAA: 0.04, costsAA: 0,
};

describe('progresso rumo à independência', () => {
  it('usa o alvo do cenário central sem INSS', () => {
    const p = fiProgress(base, 182441.997);
    expect(Math.abs(p.targetWealth - 1824419.97)).toBeLessThan(0.05);
    expect(p.ratio).toBeCloseTo(0.1, 6);
    expect(p.projectedRatioAtRetirement).toBeCloseTo(717704.54 / 1824419.97, 4);
  });
  it('limita entre 0 e 1', () => {
    expect(fiProgress(base, 5e7).ratio).toBe(1);
    expect(fiProgress(base, -100).ratio).toBe(0);
  });
  it('alvo zero conta como completo', () => {
    const p = fiProgress({ ...base, desiredMonthlyIncome: 0 }, 0);
    expect(p.targetWealth).toBe(0);
    expect(p.ratio).toBe(1);
  });
});

describe('linha do tempo do patrimônio', () => {
  it('lista vazia', () => expect(wealthTimeline([])).toEqual([]));
  it('um ponto não tem variação', () => {
    const [p] = wealthTimeline([{ month: '2026-05-01', total: 1000 }]);
    expect(p!.deltaFromPrevious).toBeNull();
    expect(p!.otherChange).toBeNull();
  });
  it('ordena e separa aporte de rendimento', () => {
    const tl = wealthTimeline(
      [
        { month: '2026-07-01', total: 13500 },
        { month: '2026-05-01', total: 10000 },
      ],
      [
        { month: '2026-05-01', amount: 1000 }, // antes do período, não entra
        { month: '2026-06-01', amount: 1000 },
        { month: '2026-07-01', amount: 2000 },
      ],
    );
    expect(tl.map(p => p.month)).toEqual(['2026-05-01', '2026-07-01']);
    expect(tl[1]!.deltaFromPrevious).toBe(3500);
    expect(tl[1]!.contributionsInPeriod).toBe(3000);
    expect(tl[1]!.otherChange).toBe(500);
  });
  it('queda de patrimônio aparece como variação negativa', () => {
    const tl = wealthTimeline([
      { month: '2026-05-01', total: 10000 },
      { month: '2026-06-01', total: 8000 },
    ]);
    expect(tl[1]!.deltaFromPrevious).toBe(-2000);
  });
  it('dois registros no mesmo mês: vale o último', () => {
    const tl = wealthTimeline([
      { month: '2026-05-01', total: 10000 },
      { month: '2026-05-01', total: 11000 },
    ]);
    expect(tl).toHaveLength(1);
    expect(tl[0]!.total).toBe(11000);
  });
});

describe('comparação com a própria situação anterior', () => {
  const entries = [
    { month: '2026-01-01', total: 10000 },
    { month: '2026-04-01', total: 12000 },
    { month: '2026-07-01', total: 15000 },
  ];
  it('menos de dois registros', () => expect(selfComparison(entries.slice(0, 1), 3)).toBeNull());
  it('3 meses atrás', () => {
    const c = selfComparison(entries, 3)!;
    expect(c.fromMonth).toBe('2026-04-01');
    expect(c.delta).toBe(3000);
    expect(c.ratioChange).toBeCloseTo(0.25);
  });
  it('sem registro antigo o bastante, usa o primeiro', () => {
    expect(selfComparison(entries, 12)!.fromMonth).toBe('2026-01-01');
  });
  it('partida zero não tem variação relativa', () => {
    expect(selfComparison([{ month: '2026-01-01', total: 0 }, { month: '2026-02-01', total: 500 }], 1)!.ratioChange).toBeNull();
  });
});

describe('progresso de meta de valor', () => {
  it('divide e limita', () => {
    expect(goalProgress(5000, 20000)).toBe(0.25);
    expect(goalProgress(30000, 20000)).toBe(1);
    expect(goalProgress(100, 0)).toBe(1);
  });
});

describe('caminho mensal projetado', () => {
  it('parte do patrimônio atual e soma aportes com retorno real', () => {
    const path = projectMonthlyPath({ ...base, returns: { ...base.returns, central: 0 } }, 5000, 3);
    expect(path).toEqual([5000, 6000, 7000, 8000]);
    const withReturn = projectMonthlyPath(base, 10000, 12);
    expect(withReturn).toHaveLength(13);
    expect(withReturn[12]!).toBeGreaterThan(10000 + 12 * 1000);
  });
});

describe('aportes por mês', () => {
  const cs = [
    { month: '2025-12-01', made: true, amount: 500, destination: 'previdencia' },
    { month: '2026-01-01', made: true, amount: 300, destination: null },
    { month: '2026-01-01', made: true, amount: 200, destination: 'reserva' },
    { month: '2026-02-01', made: false, amount: null, destination: null },
    { month: '2026-03-01', made: true, amount: null, destination: 'investimentos' },
  ];
  it('soma por mês, atravessa o ano e preenche meses vazios', () => {
    expect(monthlyContributionSeries(cs, '2026-03-01', 5)).toEqual([
      { month: '2025-11-01', amount: 0 },
      { month: '2025-12-01', amount: 500 },
      { month: '2026-01-01', amount: 500 },
      { month: '2026-02-01', amount: 0 },
      { month: '2026-03-01', amount: 0 },
    ]);
  });
  it('agrupa por destino, com não informado, e as fatias somam 1', () => {
    const d = contributionsByDestination(cs);
    expect(d.map(x => [x.destination, x.amount])).toEqual([['previdencia', 500], [null, 300], ['reserva', 200]]);
    expect(d.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 10);
  });
  it('sem valores informados, lista vazia', () => {
    expect(contributionsByDestination([{ month: '2026-01-01', made: true, amount: null, destination: null }])).toEqual([]);
  });
});
