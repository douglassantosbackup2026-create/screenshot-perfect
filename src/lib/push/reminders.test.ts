import { describe, expect, it } from "vitest";
import { periodKey, reminderPush, remindersFor } from "./reminders";

describe("lembretes por push", () => {
  it("só no dia escolhido", () => {
    expect(remindersFor(5, "2026-11-05")).toEqual(["fechamento"]);
    expect(remindersFor(5, "2026-11-06")).toEqual([]);
    expect(remindersFor(28, "2026-02-28")).toEqual(["fechamento"]);
  });
  it("um por mês", () => {
    expect(periodKey("fechamento", "2026-11-05")).toBe("M:2026-11");
  });
  it("texto sem valores, abrindo o fechamento", () => {
    const p = reminderPush("fechamento", "2026-11-05");
    expect(p.title).toBe("Hora de fechar novembro");
    expect(p.url).toBe("/fechamento");
    expect(p.body).not.toMatch(/R\$/);
  });
});
