import { describe, expect, it } from "vitest";
import { makeSeed } from "./demo-store";
import { contributionSuggestion, portfolioView } from "./selectors";

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
