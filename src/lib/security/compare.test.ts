import { describe, expect, it } from "vitest";
import { safeEqual, secretMatches } from "./compare";

describe("comparação de segredos", () => {
  it("safeEqual só aceita textos iguais", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
  it("secretMatches confere o segredo e recusa vazio ou ausente", async () => {
    expect(await secretMatches("Bearer s3cr3t", "Bearer s3cr3t")).toBe(true);
    expect(await secretMatches("Bearer errado", "Bearer s3cr3t")).toBe(false);
    expect(await secretMatches("Bearer s3cr3t-mais-longo", "Bearer s3cr3t")).toBe(false);
    expect(await secretMatches(null, "x")).toBe(false);
    expect(await secretMatches("", "")).toBe(false);
    expect(await secretMatches("x", undefined)).toBe(false);
  });
});
