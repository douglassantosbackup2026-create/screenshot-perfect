import { describe, expect, it } from "vitest";
import { addTransactionTo, deleteTransactionIn, makeSeed, updateTransactionIn } from "@/lib/data/demo-store";
import { ledgerMonth } from "@/lib/data/selectors";
import { monthOf, spDate } from "@/lib/gamification/rules";
import { addedReply, categoryList, monthSummary, planReply, planText, type Ctx } from "./pipeline";
import { parseWebhook } from "./inbound";
import { toGraphPayload } from "./outbound";

const now = new Date("2026-10-28T15:00:00Z");
const ctx: Ctx = { now, discreet: false, lastTxId: null };

describe("lançar por texto", () => {
  it('"gastei 62 na farmácia" vira um gasto de R$ 62 na conta mais usada', () => {
    const s = makeSeed(now);
    const plan = planText(s, "gastei 62 na farmácia", ctx);
    expect(plan.kind).toBe("add");
    if (plan.kind !== "add") return;
    expect(plan.input.amount).toBe(-6200);
    expect(plan.input.date).toBe(spDate(now));
    expect(s.accounts.some((a) => a.id === plan.input.accountId)).toBe(true);
  });

  it("entrada fica positiva", () => {
    const plan = planText(makeSeed(now), "recebi 800 do freela", ctx);
    expect(plan.kind === "add" && plan.input.amount).toBe(80000);
  });

  it("sem valor ou sem conta: pergunta em vez de adivinhar", () => {
    expect(planText(makeSeed(now), "farmácia", ctx).kind).toBe("reply");
    const empty = { ...makeSeed(now), accounts: [] };
    const plan = planText(empty, "gastei 62 na farmácia", ctx);
    expect(plan.kind === "reply" && plan.reply.kind === "text" && plan.reply.text).toContain("Cadastre uma conta");
  });

  it("parcelado ainda vai pelo app", () => {
    const plan = planText(makeSeed(now), "comprei uma cadeira em 6x de 95", ctx);
    expect(plan.kind === "reply" && plan.reply.kind === "text" && plan.reply.text).toContain("parceladas");
  });

  it("código de conexão, ajuda, desfazer e resumo", () => {
    const s = makeSeed(now);
    expect(planText(s, "MITIKOS-ab12cd", ctx)).toEqual({ kind: "link", code: "AB12CD" });
    expect(planText(s, "oi", ctx).kind).toBe("reply");
    expect(planText(s, "desfazer", ctx).kind).toBe("reply"); // nada recente
    expect(planText(s, "desfazer", { ...ctx, lastTxId: "t1" })).toEqual({ kind: "delete", txId: "t1" });
    expect(planText(s, "resumo", ctx).kind).toBe("reply");
  });
});

describe("o lançamento entra igual ao do app, e os botões funcionam", () => {
  it("lança, responde com Desfazer e Mudar categoria, e desfazer remove", () => {
    const s = structuredClone(makeSeed(now));
    const plan = planText(s, "gastei 62 na farmácia", ctx);
    if (plan.kind !== "add") throw new Error("esperava lançar");
    const tx = addTransactionTo(s, plan.input, now);
    expect(s.transactions.some((t) => t.id === tx.id)).toBe(true);

    const out = addedReply(s, tx, ctx);
    expect(out.kind).toBe("buttons");
    if (out.kind !== "buttons") return;
    expect(out.text).toMatch(/R\$\s62,00/); // Intl usa espaço não separável
    expect(out.buttons.map((b) => b.id)).toEqual([`undo:${tx.id}`, `cat:${tx.id}`]);

    expect(planReply(s, `undo:${tx.id}`)).toEqual({ kind: "delete", txId: tx.id });
    deleteTransactionIn(s, tx.id);
    expect(s.transactions.some((t) => t.id === tx.id)).toBe(false);
    expect(planReply(s, `undo:${tx.id}`).kind).toBe("reply"); // já não existe
  });

  it("mudar categoria: lista as de gasto, e a escolhida é gravada", () => {
    const s = structuredClone(makeSeed(now));
    const tx = addTransactionTo(s, { accountId: s.accounts[0]!.id, date: spDate(now), amount: -6200, payee: "Farmácia" }, now);
    const list = categoryList(s, tx);
    expect(list.kind).toBe("list");
    if (list.kind !== "list") return;
    expect(list.rows.length).toBeGreaterThan(0);
    expect(list.rows.length).toBeLessThanOrEqual(10);
    const pick = list.rows[0]!.id;
    const plan = planReply(s, pick);
    if (plan.kind !== "setCategory") throw new Error("esperava trocar categoria");
    updateTransactionIn(s, plan.txId, { categoryId: plan.categoryId });
    expect(s.transactions.find((t) => t.id === tx.id)!.categoryId).toBe(plan.categoryId);
  });
});

describe("resumo do mês", () => {
  it("usa os mesmos números da tela de Lançamentos", () => {
    const s = makeSeed(now);
    const out = monthSummary(s, ctx);
    const m = ledgerMonth(s, monthOf(spDate(now)));
    expect(out.kind === "text" && out.text).toContain(`Saídas: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(m.summary.expense / 100)}`);
  });
  it("modo discreto esconde os valores", () => {
    const out = monthSummary(makeSeed(now), { ...ctx, discreet: true });
    expect(out.kind === "text" && out.text).not.toMatch(/R\$\s?\d/);
  });
});

describe("payload da Meta", () => {
  it("lê texto, botão e foto; ignora status e mensagem malformada", () => {
    const value = (messages: unknown[]) => ({ entry: [{ changes: [{ field: "messages", value: { messages } }] }] });
    const msgs = parseWebhook(
      value([
        { id: "wamid.1", from: "5511999990000", timestamp: "1761660000", type: "text", text: { body: "uber 23" } },
        { id: "wamid.2", from: "5511999990000", timestamp: "1761660001", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "undo:t1" } } },
        { id: "wamid.3", from: "5511999990000", timestamp: "1761660002", type: "image", image: { id: "m1", mime_type: "image/jpeg" } },
        { id: "wamid.4", from: "não é telefone", timestamp: "x", type: "text" },
      ]),
    );
    expect(msgs.map((m) => m.kind)).toEqual(["text", "reply", "media"]);
    expect(parseWebhook({ entry: [{ changes: [{ field: "statuses", value: {} }] }] })).toEqual([]);
    expect(parseWebhook("lixo")).toEqual([]);
  });

  it("monta botões e lista dentro dos limites da Meta", () => {
    const p = toGraphPayload("5511999990000", { kind: "buttons", text: "x", buttons: [1, 2, 3, 4].map((i) => ({ id: `b${i}`, title: "Um título bem comprido demais" })) });
    const buttons = (p["interactive"] as { action: { buttons: { reply: { title: string } }[] } }).action.buttons;
    expect(buttons).toHaveLength(3);
    expect(buttons[0]!.reply.title.length).toBeLessThanOrEqual(20);
  });
});
