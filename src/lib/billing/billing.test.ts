import { describe, expect, it } from "vitest";
import { buildReference, parseReference, priceCents, toCents } from "./catalog";
import { buildManifest, hmacHex, verifyMercadoPagoSignature } from "./signature";

const USER = "11111111-2222-3333-4444-555555555555";

describe("preços cobrados", () => {
  it("Inteligência mensal custa R$ 29,90", () => expect(priceCents("inteligencia", "mensal")).toBe(2990));
  it("Inteligência anual custa R$ 239,90", () => expect(priceCents("inteligencia", "anual")).toBe(23990));
  it("Pro mensal custa R$ 59,90", () => expect(priceCents("pro", "mensal")).toBe(5990));
  it("plano gratuito não é cobrável", () => expect(priceCents("free", "mensal")).toBeNull());
  it("converte 29.9 em 2990 centavos", () => expect(toCents(29.9)).toBe(2990));
});

describe("referência do pagamento", () => {
  it("ida e volta", () => expect(parseReference(buildReference(USER, "pro", "mensal"))).toEqual({ userId: USER, plan: "pro", period: "mensal" }));
  it("rejeita período que não existe para o plano", () => expect(parseReference(`${USER}|pro|anual`)).toBeNull());
  it("rejeita usuário inválido", () => expect(parseReference("abc|pro|mensal")).toBeNull());
});

describe("assinatura do webhook", () => {
  it("aceita assinatura correta e recusa adulterada", async () => {
    const secret = "segredo-teste";
    const v1 = await hmacHex(secret, buildManifest("123", "req-1", "1700"));
    const header = `ts=1700,v1=${v1}`;
    expect(await verifyMercadoPagoSignature({ secret, header, requestId: "req-1", dataId: "123" })).toBe(true);
    expect(await verifyMercadoPagoSignature({ secret, header, requestId: "req-1", dataId: "999" })).toBe(false);
    expect(await verifyMercadoPagoSignature({ secret, header: null, requestId: "req-1", dataId: "123" })).toBe(false);
  });
});
