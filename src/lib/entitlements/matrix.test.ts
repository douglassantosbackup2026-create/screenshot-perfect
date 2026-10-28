import { describe, it, expect } from "vitest";
import { canCreateLimit, canUse, FEATURES, featuresOf, resolveAccess } from "./matrix";

const now = new Date("2026-10-27T12:00:00Z");

describe("acesso", () => {
  it("cobrança desligada: tudo liberado", () => {
    const a = resolveAccess({ billingEnabled: false, entitlement: null });
    expect(a.launchOpen).toBe(true);
    expect(Object.keys(FEATURES).every((k) => canUse(k as keyof typeof FEATURES, a))).toBe(true);
  });
  it("cobrança ligada, sem direito: gratuito bloqueia os recursos pagos", () => {
    const a = resolveAccess({ billingEnabled: true, entitlement: null, now });
    expect(a).toEqual({ tier: "free", launchOpen: false });
    expect(canUse("what_if", a)).toBe(false);
  });
  it("direito válido libera o plano", () => {
    const a = resolveAccess({
      billingEnabled: true,
      entitlement: { plan: "inteligencia", validUntil: "2026-11-27T00:00:00Z" },
      now,
    });
    expect(a.tier).toBe("inteligencia");
    expect(canUse("goal_seek", a)).toBe(true);
  });
  it("direito vencido ou plano desconhecido volta ao gratuito", () => {
    expect(
      resolveAccess({
        billingEnabled: true,
        entitlement: { plan: "pro", validUntil: "2026-10-01T00:00:00Z" },
        now,
      }).tier,
    ).toBe("free");
    expect(
      resolveAccess({
        billingEnabled: true,
        entitlement: { plan: "ouro", validUntil: "2027-01-01T00:00:00Z" },
        now,
      }).tier,
    ).toBe("free");
  });
  it("plano maior inclui os recursos do menor", () => {
    expect(featuresOf("free")).toHaveLength(0);
    expect(featuresOf("pro").length).toBeGreaterThanOrEqual(featuresOf("inteligencia").length);
  });
});

describe("limites de gasto", () => {
  it("gratuito cria 1; Inteligência, quantos quiser; lançamento libera tudo", () => {
    const free = { tier: "free" as const, launchOpen: false };
    expect(canCreateLimit(0, free)).toBe(true);
    expect(canCreateLimit(1, free)).toBe(false);
    expect(canCreateLimit(5, { tier: "inteligencia", launchOpen: false })).toBe(true);
    expect(canCreateLimit(5, { tier: "free", launchOpen: true })).toBe(true);
  });
});
