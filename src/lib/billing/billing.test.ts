import { describe, expect, it } from "vitest";
import { buildReference, parseReference, priceCents, toCents } from "./catalog";
import { buildManifest, hmacHex, tsToMs, verifyMercadoPagoSignature } from "./signature";

const USER = "11111111-2222-3333-4444-555555555555";

describe("preços cobrados", () => {
  it("Inteligência mensal custa R$ 39,90", () => expect(priceCents("inteligencia", "mensal")).toBe(3990));
  it("Inteligência anual custa R$ 399,00", () => expect(priceCents("inteligencia", "anual")).toBe(39900));
  it("Pro mensal custa R$ 59,90", () => expect(priceCents("pro", "mensal")).toBe(5990));
  it("não existe plano grátis para cobrar", () => expect(priceCents("free", "mensal")).toBeNull());
  it("converte 39.9 em 3990 centavos", () => expect(toCents(39.9)).toBe(3990));
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
    const now = 1700 * 1000;
    expect(await verifyMercadoPagoSignature({ secret, header, requestId: "req-1", dataId: "123", now })).toBe(true);
    expect(await verifyMercadoPagoSignature({ secret, header, requestId: "req-1", dataId: "999", now })).toBe(false);
    expect(await verifyMercadoPagoSignature({ secret, header: null, requestId: "req-1", dataId: "123", now })).toBe(false);
  });

  it("recusa a mesma notificação reenviada mais de 5 minutos depois", async () => {
    const secret = "segredo-teste";
    const header = `ts=1700,v1=${await hmacHex(secret, buildManifest("123", "req-1", "1700"))}`;
    const at = (ms: number) => verifyMercadoPagoSignature({ secret, header, requestId: "req-1", dataId: "123", now: ms });
    expect(await at(1700 * 1000 + 4 * 60_000)).toBe(true);
    expect(await at(1700 * 1000 + 6 * 60_000)).toBe(false);
    expect(await at(1700 * 1000 - 6 * 60_000)).toBe(false);
  });

  it("ts em segundos ou milissegundos", () => {
    expect(tsToMs("1700")).toBe(1_700_000);
    expect(tsToMs("1704908010123")).toBe(1_704_908_010_123);
    expect(tsToMs("abc")).toBeNull();
  });
});
