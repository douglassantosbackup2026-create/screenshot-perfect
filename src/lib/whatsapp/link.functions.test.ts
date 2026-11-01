import { describe, expect, it } from "vitest";
import { CODE_LENGTH, newCode } from "./link.functions";

describe("código de conexão do WhatsApp", () => {
  it("8 caracteres do alfabeto sem confusões", () => {
    for (let i = 0; i < 200; i++) expect(newCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/);
    expect(CODE_LENGTH).toBe(8);
  });
  it("sem viés: cada letra aparece perto da média", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) for (const c of newCode()) counts.set(c, (counts.get(c) ?? 0) + 1);
    const mean = (4000 * 8) / 31;
    expect(counts.size).toBe(31);
    for (const n of counts.values()) expect(Math.abs(n - mean) / mean).toBeLessThan(0.15);
  });
});
