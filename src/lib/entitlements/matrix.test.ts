import { describe, it, expect } from "vitest";
import { CACHE_TTL_MS, entitlementFromCache, resolveAccess } from "./matrix";

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

describe("assinatura guardada no aparelho (usada só se a consulta falhar)", () => {
  const t = now.getTime();
  const ok = { plan: "inteligencia", validUntil: "2026-11-27T00:00:00+00:00", checkedAt: t - 60_000 };
  it("vale se tiver o formato certo e tiver sido conferida nas últimas 24 h", () => {
    expect(entitlementFromCache(JSON.stringify(ok), t)).toEqual({ plan: "inteligencia", validUntil: ok.validUntil });
  });
  it("conferida há mais de 24 h ou no futuro: não vale", () => {
    expect(entitlementFromCache(JSON.stringify({ ...ok, checkedAt: t - CACHE_TTL_MS - 1 }), t)).toBeNull();
    expect(entitlementFromCache(JSON.stringify({ ...ok, checkedAt: t + 60_000 }), t)).toBeNull();
  });
  it("adulterado ou no formato antigo: não vale (falha fechado)", () => {
    expect(entitlementFromCache(JSON.stringify({ tier: "pro", active: true, billingOff: false }), t)).toBeNull();
    expect(entitlementFromCache(JSON.stringify({ ...ok, validUntil: "para sempre" }), t)).toBeNull();
    expect(entitlementFromCache("{", t)).toBeNull();
    expect(entitlementFromCache(null, t)).toBeNull();
  });
  it("mesmo válido, uma assinatura vencida não libera", () => {
    const e = entitlementFromCache(JSON.stringify({ ...ok, validUntil: "2026-10-01T00:00:00Z" }), t);
    expect(resolveAccess({ billingEnabled: true, entitlement: e, now }).active).toBe(false);
  });
});
