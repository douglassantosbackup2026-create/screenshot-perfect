import { describe, expect, it } from "vitest";
import { errMsg } from "./errors";

describe("errMsg", () => {
  it("usa a mensagem do Error", () => expect(errMsg(new Error("Conta sem nome."))).toBe("Conta sem nome."));
  it("qualquer outra coisa vira a mensagem genérica", () => {
    expect(errMsg("x")).toBe("Não foi possível concluir agora. Tente de novo.");
    expect(errMsg(new Error(""), "Falhou.")).toBe("Falhou.");
    expect(errMsg(null, "Falhou.")).toBe("Falhou.");
  });
});
