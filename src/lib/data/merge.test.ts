import { describe, expect, it } from "vitest";
import { merge3 } from "./merge";

const tx = (id: string, amount: number, categoryId: string | null = null) => ({ id, amount, categoryId });

describe("merge3", () => {
  it("lançamento offline neste aparelho + lançamento pelo WhatsApp: ficam os dois", () => {
    const base = { transactions: [tx("a", -100)], profile: { name: "Ana" } };
    const local = { transactions: [tx("a", -100), tx("offline", -50)], profile: { name: "Ana" } };
    const remote = { transactions: [tx("a", -100), tx("whats", -30)], profile: { name: "Ana" } };
    const r = merge3(base, local, remote);
    expect(r.value.transactions.map((t) => t.id)).toEqual(["a", "whats", "offline"]);
    expect(r.lost).toEqual([]);
  });

  it("apagado aqui e intocado lá: some; apagado aqui e editado lá: fica a edição", () => {
    const base = { transactions: [tx("a", -1), tx("b", -2)] };
    const local = { transactions: [] as ReturnType<typeof tx>[] };
    const remote = { transactions: [tx("a", -1), tx("b", -2, "cat-mercado")] };
    expect(merge3(base, local, remote).value.transactions).toEqual([tx("b", -2, "cat-mercado")]);
  });

  it("mesmo item mudado dos dois lados em campos diferentes: junta os campos", () => {
    const base = { transactions: [tx("a", -100)] };
    const local = { transactions: [tx("a", -120)] };
    const remote = { transactions: [tx("a", -100, "cat-saude")] };
    expect(merge3(base, local, remote).value.transactions).toEqual([tx("a", -120, "cat-saude")]);
  });

  it("mesmo valor simples mudado dos dois lados: fica o do banco e avisa", () => {
    const base = { profile: { reminderDay: 5 } };
    const r = merge3(base, { profile: { reminderDay: 10 } }, { profile: { reminderDay: 20 } });
    expect(r.value.profile.reminderDay).toBe(20);
    expect(r.lost).toEqual(["profile.reminderDay"]);
  });

  it("listas sem id (xpEvents): une os itens novos dos dois lados", () => {
    const e = (k: string) => ({ action: "x", periodKey: k, xp: 10 });
    const r = merge3({ xp: [e("1")] }, { xp: [e("1"), e("2")] }, { xp: [e("1"), e("3")] });
    expect(r.value.xp).toEqual([e("1"), e("3"), e("2")]);
  });

  it("só um lado mudou: fica esse lado inteiro", () => {
    const base = { a: 1, b: [1] };
    expect(merge3(base, { a: 2, b: [1] }, base).value).toEqual({ a: 2, b: [1] });
    expect(merge3(base, base, { a: 3, b: [1, 2] }).value).toEqual({ a: 3, b: [1, 2] });
  });
});
