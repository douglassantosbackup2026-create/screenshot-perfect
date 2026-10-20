import { describe, expect, it } from "vitest";
import { dayParts, monthCloseEmail, periodKey, remindersFor, signUser, verifyUser, weeklyMissionEmail, type Recipient } from "./reminders";

const r: Recipient = { userId: "u1", email: "a@b.co", displayName: "Ana", monthlyReminder: true, reminderDay: 5, weeklyReminder: true };

describe("lembretes", () => {
  it("dia e dia da semana", () => {
    expect(dayParts("2026-10-05")).toEqual({ day: 5, isoWeekday: 1 }); // segunda
    expect(dayParts("2026-10-11")).toEqual({ day: 11, isoWeekday: 7 }); // domingo
  });

  it("mensal no dia escolhido, semanal às segundas, e respeita quem desligou", () => {
    expect(remindersFor(r, "2026-10-05")).toEqual(["fechamento", "missao"]);
    expect(remindersFor(r, "2026-10-12")).toEqual(["missao"]);
    expect(remindersFor(r, "2026-10-06")).toEqual([]);
    expect(remindersFor({ ...r, monthlyReminder: false, weeklyReminder: false }, "2026-10-05")).toEqual([]);
  });

  it("uma vez por mês o fechamento, uma vez por dia a missão", () => {
    expect(periodKey("fechamento", "2026-10-05")).toBe("M:2026-10");
    expect(periodKey("missao", "2026-10-05")).toBe("D:2026-10-05");
  });

  it("link de sair da lista: assinado e conferido", async () => {
    const t = await signUser("u1", "segredo");
    expect(t).toMatch(/^[0-9a-f]{32}$/);
    expect(await verifyUser("u1", t, "segredo")).toBe(true);
    expect(await verifyUser("u2", t, "segredo")).toBe(false);
    expect(await verifyUser("u1", t, "outro")).toBe(false);
  });

  it("e-mails sem valores, com link do app e de sair, e nome escapado", () => {
    const m = monthCloseEmail("<Ana>", "2026-10-05", "https://app.x", "https://app.x/api/lembretes/sair?u=1&t=2");
    expect(m.subject).toBe("Seu fechamento de outubro está esperando");
    expect(m.html).toContain('href="https://app.x/fechamento"');
    expect(m.html).toContain("&lt;Ana&gt;");
    expect(m.html).not.toMatch(/R\$/);
    expect(m.headers["List-Unsubscribe"]).toBe("<https://app.x/api/lembretes/sair?u=1&t=2>");
    const w = weeklyMissionEmail(null, { title: "Revisão relâmpago", description: "Confira a renda." }, "https://app.x", "https://app.x/sair");
    expect(w.subject).toBe("Missão da semana: Revisão relâmpago");
    expect(w.text).toContain("https://app.x/hoje");
  });
});
