import { describe, it, expect } from "vitest";
import { resolveAccess } from "./matrix";

const now = new Date("2026-10-27T12:00:00Z");

describe("acesso", () => {
  it("cobrança desligada: todo mundo entra", () => {
    expect(resolveAccess({ billingEnabled: false, entitlement: null })).toEqual({
      tier: null,
      active: true,
      billingOff: true,
    });
  });
  it("cobrança ligada, sem assinatura: não entra (não existe plano grátis)", () => {
    expect(resolveAccess({ billingEnabled: true, entitlement: null, now })).toEqual({
      tier: null,
      active: false,
      billingOff: false,
    });
  });
  it("assinatura válida libera o plano", () => {
    const a = resolveAccess({
      billingEnabled: true,
      entitlement: { plan: "inteligencia", validUntil: "2026-11-27T00:00:00Z" },
      now,
    });
    expect(a).toEqual({ tier: "inteligencia", active: true, billingOff: false });
  });
  it("assinatura vencida ou plano desconhecido não entra", () => {
    const expired = resolveAccess({
      billingEnabled: true,
      entitlement: { plan: "pro", validUntil: "2026-10-01T00:00:00Z" },
      now,
    });
    expect(expired).toMatchObject({ tier: null, active: false });
    const unknown = resolveAccess({
      billingEnabled: true,
      entitlement: { plan: "free", validUntil: "2027-01-01T00:00:00Z" },
      now,
    });
    expect(unknown).toMatchObject({ tier: null, active: false });
  });
  it("vence no instante exato: já não vale", () => {
    const a = resolveAccess({
      billingEnabled: true,
      entitlement: { plan: "inteligencia", validUntil: now.toISOString() },
      now,
    });
    expect(a.active).toBe(false);
  });
});
