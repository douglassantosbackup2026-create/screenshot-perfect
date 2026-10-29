import { describe, expect, it } from "vitest";
import { deepFreeze, share, shareState } from "./share";

const base = () => ({
  profile: { name: "Ana", hideValues: true },
  transactions: [
    { id: "t1", amount: -100, tags: ["a"] },
    { id: "t2", amount: -200, tags: [] },
    { id: "t3", amount: 300, tags: [] },
  ],
  budget: { assigned: { "2026-10": { e1: 1000 } }, templates: [] },
  days: ["2026-10-01"],
});

describe("compartilhamento estrutural", () => {
  it("o que não mudou volta a ser o mesmo objeto; o que mudou é novo", () => {
    const prev = base();
    const next = structuredClone(prev);
    next.profile.hideValues = false;
    const out = shareState(prev, next);
    expect(out).not.toBe(prev); // a raiz é sempre nova
    expect(out.profile).not.toBe(prev.profile);
    expect(out.profile).toEqual({ name: "Ana", hideValues: false });
    expect(out.transactions).toBe(prev.transactions);
    expect(out.budget).toBe(prev.budget);
    expect(out.days).toBe(prev.days);
  });

  it("numa lista, só o item alterado é novo, mesmo com outro na frente", () => {
    const prev = base();
    const next = structuredClone(prev);
    next.transactions[1]!.amount = -250;
    next.transactions.unshift({ id: "t0", amount: -5, tags: [] });
    const out = share(prev, next);
    expect(out.transactions).not.toBe(prev.transactions);
    expect(out.transactions.map((t) => t.id)).toEqual(["t0", "t1", "t2", "t3"]);
    expect(out.transactions[1]).toBe(prev.transactions[0]); // t1 igual, outra posição
    expect(out.transactions[2]).not.toBe(prev.transactions[1]); // t2 mudou
    expect(out.transactions[3]).toBe(prev.transactions[2]);
  });

  it("item removido ou chave nova contam como mudança", () => {
    const prev = base();
    const removed = structuredClone(prev);
    removed.transactions.pop();
    expect(share(prev, removed).transactions).not.toBe(prev.transactions);
    const added = structuredClone(prev) as ReturnType<typeof base> & { limits?: unknown[] };
    added.limits = [];
    const out = share(prev as typeof added, added);
    expect(out).not.toBe(prev);
    expect(out.transactions).toBe(prev.transactions);
  });

  it("nada mudou: tudo reaproveitado, raiz nova", () => {
    const prev = base();
    const out = shareState(prev, structuredClone(prev));
    expect(out).not.toBe(prev);
    expect(out).toEqual(prev);
    for (const k of Object.keys(prev) as (keyof typeof prev)[]) expect(out[k]).toBe(prev[k]);
  });

  it("congelado: escrever no estado vivo lança erro", () => {
    const s = deepFreeze(base());
    expect(() => s.transactions.push({ id: "x", amount: 1, tags: [] })).toThrow();
    expect(() => {
      s.profile.name = "Outra";
    }).toThrow();
    // A cópia que as ações usam continua livre.
    const draft = structuredClone(s);
    draft.profile.name = "Outra";
    expect(draft.profile.name).toBe("Outra");
  });
});
