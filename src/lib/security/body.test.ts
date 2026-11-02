import { describe, expect, it } from "vitest";
import { readLimitedText } from "./body";

const post = (body: string | null, headers: Record<string, string> = {}) => new Request("https://x.test/", { method: "POST", body, headers });

describe("readLimitedText", () => {
  it("devolve o corpo dentro do limite", async () => {
    expect(await readLimitedText(post('{"a":1}'), 100)).toBe('{"a":1}');
  });
  it("recusa pelo Content-Length sem ler o corpo", async () => {
    expect(await readLimitedText(post("x", { "content-length": "999999" }), 100)).toBeNull();
  });
  it("para de ler quando o corpo real passa do limite", async () => {
    expect(await readLimitedText(post("x".repeat(101)), 100)).toBeNull();
  });
  it("corpo vazio vira null", async () => {
    expect(await readLimitedText(post(null), 100)).toBeNull();
    expect(await readLimitedText(post(""), 100)).toBeNull();
  });
  it("conta bytes, não caracteres (acentos ocupam 2)", async () => {
    expect(await readLimitedText(post("é".repeat(60)), 100)).toBeNull();
    expect(await readLimitedText(post("é".repeat(50)), 100)).toBe("é".repeat(50));
  });
});
