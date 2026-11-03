import { describe, expect, it } from "vitest";
import { generatePassword, isStrongPassword, passwordProblems, safePath } from "./password";

describe("regra de senha", () => {
  it("exige 8 caracteres", () => expect(isStrongPassword("abc1234")).toBe(false));
  it("exige letra", () => expect(isStrongPassword("12345678")).toBe(false));
  it("exige número", () => expect(isStrongPassword("abcdefgh")).toBe(false));
  it("aceita letra + número com 8", () => expect(isStrongPassword("abcdefg1")).toBe(true));
});

describe("safePath", () => {
  it("bloqueia outro site", () => expect(safePath("//mal.com")).toBe("/hoje"));
  it("mantém caminho interno", () => expect(safePath("/plano")).toBe("/plano"));
  it("bloqueia barra invertida, que o navegador lê como barra", () => {
    expect(safePath("/\\mal.com")).toBe("/hoje");
    expect(safePath("/\\/mal.com")).toBe("/hoje");
  });
  it("bloqueia caracteres de controle e esquemas", () => {
    expect(safePath("/\tmal.com")).toBe("/hoje");
    expect(safePath("javascript:alert(1)")).toBe("/hoje");
  });
  it("mantém busca e âncora do próprio app", () => expect(safePath("/diario?lancar=true#x")).toBe("/diario?lancar=true#x"));
});

describe("senha temporária do cadastro pelo painel", () => {
  it("100 senhas: 14 caracteres, todas válidas, sem caracteres ambíguos e diferentes entre si", () => {
    const all = Array.from({ length: 100 }, () => generatePassword());
    for (const p of all) {
      expect(p).toHaveLength(14);
      expect(passwordProblems(p)).toEqual([]);
      expect(p).not.toMatch(/[01lIoO]/);
    }
    expect(new Set(all).size).toBe(100);
  });
});
