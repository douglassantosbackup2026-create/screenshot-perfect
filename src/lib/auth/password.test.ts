import { describe, expect, it } from "vitest";
import { isStrongPassword, safePath } from "./password";

describe("regra de senha", () => {
  it("exige 8 caracteres", () => expect(isStrongPassword("abc1234")).toBe(false));
  it("exige letra", () => expect(isStrongPassword("12345678")).toBe(false));
  it("exige número", () => expect(isStrongPassword("abcdefgh")).toBe(false));
  it("aceita letra + número com 8", () => expect(isStrongPassword("abcdefg1")).toBe(true));
});

describe("safePath", () => {
  it("bloqueia outro site", () => expect(safePath("//mal.com")).toBe("/hoje"));
  it("mantém caminho interno", () => expect(safePath("/plano")).toBe("/plano"));
});
