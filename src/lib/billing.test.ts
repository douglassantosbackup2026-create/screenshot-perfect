import { describe, expect, it } from "vitest";
import { canUse, currentPlan, decodeRef, encodeRef, extendValidity, priceCents } from "./billing";

const NOW = new Date("2026-10-20T12:00:00Z");
const UID = "11111111-1111-4111-8111-111111111111";

describe("cobrança", () => {
  it("preço: anual sai por 10 mensalidades", () => {
    expect(priceCents("inteligencia", "mensal")).toBe(2990);
    expect(priceCents("inteligencia", "anual")).toBe(29900);
    expect(priceCents("pro", "anual")).toBe(59900);
  });

  it("plano em vigor só enquanto a validade não passou", () => {
    expect(currentPlan(null, NOW)).toBe("free");
    expect(currentPlan({ plan: "pro", validUntil: "2026-11-01T00:00:00Z" }, NOW)).toBe("pro");
    expect(currentPlan({ plan: "pro", validUntil: "2026-10-01T00:00:00Z" }, NOW)).toBe("free");
  });

  it("sem cobrança ligada, tudo liberado; com dados já registrados, nunca bloqueia", () => {
    expect(canUse("orcamento", "free", { billing: false })).toBe(true);
    expect(canUse("orcamento", "free", { billing: true })).toBe(false);
    expect(canUse("orcamento", "free", { billing: true, hasData: true })).toBe(true);
    expect(canUse("orcamento", "inteligencia", { billing: true })).toBe(true);
    expect(canUse("importacao", "pro", { billing: true })).toBe(true);
  });

  it("referência do pagamento: ida e volta, e recusa o que não é nosso", () => {
    expect(decodeRef(encodeRef(UID, "pro", "anual"))).toEqual({ userId: UID, plan: "pro", period: "anual" });
    expect(decodeRef("x|pro|anual")).toBeNull();
    expect(decodeRef(`${UID}|gold|anual`)).toBeNull();
    expect(decodeRef(null)).toBeNull();
  });

  it("renovar antes do vencimento soma a partir do vencimento; depois, de agora", () => {
    expect(extendValidity("2026-10-25T12:00:00.000Z", "mensal", NOW)).toBe("2026-11-25T12:00:00.000Z");
    expect(extendValidity("2026-10-01T12:00:00.000Z", "mensal", NOW)).toBe("2026-11-20T12:00:00.000Z");
    expect(extendValidity(null, "anual", NOW)).toBe("2027-10-21T12:00:00.000Z");
  });
});
