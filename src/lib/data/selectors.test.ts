import { describe, expect, it } from "vitest";
import { emptyState, makeSeed } from "./demo-store";
import { monthOf, spDate } from "@/lib/gamification/rules";
import { goalsView, contributionSuggestion, quickEntryDraft, dailyAlerts, installmentsView, ledgerMonth, firstSteps, monthCloseShare, monthHero, monthProjection, nextStep, portfolioView, uncategorizedGroups } from "./selectors";

describe("carteira do exemplo da Ana", () => {
  it("posições pelo preço médio, ganho realizado, proventos e rentabilidade anual", () => {
    const v = portfolioView(makeSeed());
    const bova = v.positions.find((p) => p.holding.name === "BOVA11")!;
    expect(bova).toMatchObject({ quantity: 4, avgPrice: 11000, costBasis: 44000, marketValue: 50000, unrealized: 6000, realized: 1000, income: 250 });
    expect(v.totals.marketValue).toBe(200000);
    expect(v.performance).toMatchObject({ annual: false });
  });

  it("alocação dos itens para a aposentadoria: o PGBL sem posições conta como Previdência", () => {
    const v = portfolioView(makeSeed());
    expect(v.current).toEqual({ previdencia: 800000, renda_fixa: 150000, acoes: 50000 });
    expect(v.allocation.map((a) => [a.assetClass, a.share])).toEqual([
      ["previdencia", 0.8],
      ["renda_fixa", 0.15],
      ["acoes", 0.05],
    ]);
  });

  it("onde aportar: o que falta no envelope Aposentadoria, dividido para chegar perto das metas", () => {
    const s = contributionSuggestion(makeSeed());
    expect(s.source).toBe("orcamento");
    expect(s.amount).toBe(100000);
    expect(s.items.map((i) => [i.assetClass, i.amount])).toEqual([
      ["renda_fixa", 55000],
      ["acoes", 45000],
    ]);
  });

  it("sem metas, não sugere divisão", () => {
    const seed = makeSeed();
    seed.allocationTargets = {};
    expect(contributionSuggestion(seed)).toMatchObject({ hasTargets: false, items: [] });
  });
});

describe("dia a dia no exemplo da Ana", () => {
  const now = new Date("2026-10-27T15:00:00Z");
  const s = makeSeed(now);
  it("mostra o preço do streaming que subiu e a farmácia repetida", () => {
    const kinds = dailyAlerts(s, now).map((a) => a.kind);
    expect(kinds).toContain("preco");
    expect(kinds).toContain("duplicado");
  });
  it("tem o notebook parcelado em andamento, com o selo da parcela", () => {
    const v = installmentsView(s, now);
    expect(v.purchases).toHaveLength(1);
    expect(v.purchases[0]!.left).toBe(8);
    const row = ledgerMonth(s, "2026-10-01").days.flatMap((d) => d.items).find((t) => t.payee === "Notebook");
    expect(row?.installment).toEqual({ number: 2, count: 10 });
    expect(monthProjection(s, now)).not.toBeNull();
  });
});

describe("lançamento por frase", () => {
  const now = new Date("2026-10-27T15:00:00Z");
  it("a regra da pessoa vem antes da palavra-chave; parcelado abre com o número de parcelas", () => {
    const s = makeSeed(now);
    expect(quickEntryDraft(s, "supermercado 120", now).draft.categoryId).toBe("cat-mercado");
    s.categoryRules.push({ id: "r", op: "igual", value: "Farmácia", categoryId: "cat-outros", renameTo: null });
    expect(quickEntryDraft(s, "gastei 62 na farmácia", now).draft).toMatchObject({ amount: 6200, categoryId: "cat-outros" });
    expect(quickEntryDraft(s, "comprei uma cadeira em 6x de 95", now).draft).toMatchObject({ amount: 57000, installments: 6 });
  });
});

describe("fechamento do mês", () => {
  const t = (id: string, payee: string, amount: number) => ({ ...makeSeed().transactions[0]!, id, payee, amount, categoryId: null });

  it("agrupa os sem categoria pela descrição, sem misturar entrada e saída", () => {
    const g = uncategorizedGroups([t("1", "iFood", -3000), t("2", " ifood ", -4500), t("3", "Uber", -2000), t("4", "iFood", 1000)]);
    expect(g.map((x) => [x.payee, x.income, x.items.length, x.total])).toEqual([
      ["iFood", false, 2, -7500],
      ["Uber", false, 1, -2000],
      ["iFood", true, 1, 1000],
    ]);
  });

  it("o resumo para compartilhar só tem proporções", () => {
    const s = makeSeed();
    const month = s.contributions.find((c) => c.made && c.amount != null)!.month;
    const r = monthCloseShare(s, month);
    expect(r.contributed).toBe(true);
    expect(r.ratio).toBeGreaterThan(0);
    expect(Object.keys(r)).toEqual(["contributed", "ratio", "fi"]);
    expect(monthCloseShare(s, "1990-01-01")).toMatchObject({ contributed: false, ratio: null });
  });
});

describe("Início: próximo passo, checklist e número do mês", () => {
  const now = new Date();
  const month = monthOf(spDate(now));
  const fresh = () => {
    const s = emptyState(now);
    s.profile.onboardingCompletedAt = now.toISOString();
    return s;
  };
  const withPlan = () => {
    const s = fresh();
    const seed = makeSeed(now);
    s.plan = { ...seed.plan!, updatedAt: now.toISOString() };
    return s;
  };

  it("segue a ordem: plano, aporte, conta, patrimônio, fechar", () => {
    const s = fresh();
    expect(nextStep(s, now)?.key).toBe("plano");
    const p = withPlan();
    expect(nextStep(p, now)?.key).toBe("aporte");
    p.contributions = [{ id: "c", month, made: true, amount: 500, destination: "previdencia", note: null, createdAt: now.toISOString() }];
    expect(nextStep(p, now)?.key).toBe("conta");
    p.accounts = [{ id: "a", name: "Conta", kind: "corrente", openingBalance: 0, createdAt: now.toISOString() }];
    expect(nextStep(p, now)?.key).toBe("patrimonio");
    expect(nextStep(p, now)?.search).toEqual({ registrar: true });
  });

  it("com aporte e patrimônio em dia, mas sem conta, o próximo passo é cadastrar a conta", () => {
    const p = withPlan();
    p.contributions = [{ id: "c", month, made: true, amount: 500, destination: "previdencia", note: null, createdAt: now.toISOString() }];
    p.wealthEntries = [{ id: "w", month, total: 1000, previdencia: null, note: null, createdAt: now.toISOString(), breakdown: null }];
    // Sem conta, o passo de conta vem antes; com conta mas sem lançamentos, o fechamento ainda não está completo.
    expect(nextStep(p, now)?.key).toBe("conta");
  });

  it("o checklist some quando os três primeiros passos estão feitos", () => {
    const s = fresh();
    expect(firstSteps(s)?.map((i) => i.done)).toEqual([false, false, false]);
    expect(firstSteps(makeSeed(now))).toBeNull();
  });

  it("número do mês: pede o aporte do plano e diferencia 'não registrado' de 'registrado sem aporte'", () => {
    expect(monthHero(fresh(), now)).toBeNull();
    const p = withPlan();
    const h = monthHero(p, now)!;
    expect(h.required).toBeGreaterThan(0);
    expect(h.contributed).toBeNull();
    p.contributions = [{ id: "c", month, made: false, amount: null, destination: null, note: null, createdAt: now.toISOString() }];
    expect(monthHero(p, now)!.contributed).toBe(0);
  });
});

describe("metas além da aposentadoria", () => {
  const now = new Date("2026-10-30T12:00:00-03:00");
  const goal = (over: Record<string, unknown>) => ({
    id: "g",
    title: "Meta",
    kind: "valor" as const,
    target: 12000,
    deadline: "2027-10-01",
    createdAt: "2026-10-01T00:00:00Z",
    completedAt: null,
    template: "viagem" as const,
    assetIds: [],
    accountIds: [],
    monthlyContribution: null,
    expectedReturn: 0,
    ...over,
  });

  it("com conta ligada, mede só o saldo dela (centavos → reais)", () => {
    const s = emptyState();
    s.accounts = [{ id: "a1", name: "Poupança", kind: "poupanca", openingBalance: 300000, createdAt: "2026-01-01T00:00:00Z" }];
    s.goals = [goal({ accountIds: ["a1"] })];
    const [v] = goalsView(s, now);
    expect(v!.source).toBe("vinculos");
    expect(v!.plan).toMatchObject({ current: 3000, missing: 9000, verdict: "sem_ritmo" });
    expect(v!.plan!.requiredMonthly).toBe(750);
  });

  it("sem vínculo, usa o patrimônio total; hábitos ficam por último, sem plano", () => {
    const s = emptyState();
    s.goals = [goal({ id: "h", kind: "habito", target: null }), goal({ deadline: null })];
    const v = goalsView(s, now);
    expect(v.map((x) => x.goal.id)).toEqual(["g", "h"]);
    expect(v[0]!.source).toBe("patrimonio");
    expect(v[1]!.plan).toBeNull();
  });
});
