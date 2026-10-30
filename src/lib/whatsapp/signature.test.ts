import { describe, expect, it } from "vitest";
import { hmacHex } from "@/lib/billing/signature";
import { verifyMetaSignature } from "./signature";

describe("assinatura do webhook da Meta", () => {
  it("aceita o corpo assinado e recusa corpo alterado, assinatura ausente ou malformada", async () => {
    const secret = "app-secret-teste";
    const body = '{"entry":[]}';
    const header = `sha256=${await hmacHex(secret, body)}`;
    expect(await verifyMetaSignature(secret, header, body)).toBe(true);
    expect(await verifyMetaSignature(secret, header, '{"entry":[1]}')).toBe(false);
    expect(await verifyMetaSignature(secret, null, body)).toBe(false);
    expect(await verifyMetaSignature(secret, "sha1=abc", body)).toBe(false);
    expect(await verifyMetaSignature("outro-segredo", header, body)).toBe(false);
  });
});
