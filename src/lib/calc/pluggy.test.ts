import { describe, expect, it } from "vitest";
import { looksLikeContribution, pluggyAccountKind, pluggyInvestmentKind, pluggyTxCents, syncedOpeningBalance } from "./bankSync";

describe("Pluggy → app", () => {
  it("tipo de conta", () => {
    expect(pluggyAccountKind("CREDIT", "CREDIT_CARD")).toBe("cartao");
    expect(pluggyAccountKind("BANK", "SAVINGS_ACCOUNT")).toBe("poupanca");
    expect(pluggyAccountKind("BANK", "CHECKING_ACCOUNT")).toBe("corrente");
  });
  it("PGBL/VGBL viram previdência", () => {
    expect(pluggyInvestmentKind("PENSION", "Plano X")).toBe("previdencia");
    expect(pluggyInvestmentKind("FIXED_INCOME", "VGBL Icatu")).toBe("previdencia");
    expect(pluggyInvestmentKind("FIXED_INCOME", "CDB 120%")).toBe("investimento");
  });
  it("débito sempre negativo, crédito positivo", () => {
    expect(pluggyTxCents(150.5, "DEBIT")).toBe(-15050);
    expect(pluggyTxCents(-150.5, "DEBIT")).toBe(-15050);
    expect(pluggyTxCents(-20, "CREDIT")).toBe(2000);
  });
  it("aporte só em saída para previdência/investimento", () => {
    expect(looksLikeContribution(-50000, "APORTE PGBL BRASILPREV")).toBe(true);
    expect(looksLikeContribution(50000, "RESGATE PGBL")).toBe(false);
    expect(looksLikeContribution(-3299, "SUPERMERCADO")).toBe(false);
  });
  it("saldo de investimento bate com o banco", () => {
    expect(syncedOpeningBalance(100000, [20000, -5000])).toBe(85000);
  });
});
