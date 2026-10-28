import { describe, expect, it } from "vitest";
import { emptyState, makeSeed } from "./demo-store";
import { repairState } from "./state-schema";

const fallback = emptyState();

describe("reparo do estado salvo", () => {
  it("um estado válido passa sem mudança", () => {
    const seed = makeSeed();
    const r = repairState(JSON.parse(JSON.stringify(seed)), fallback);
    expect(r.dropped).toBe(0);
    expect(r.reset).toEqual([]);
    expect(r.state.transactions).toHaveLength(seed.transactions.length);
    expect(r.state.profile.displayName).toBe("Ana");
  });

  it("qualquer coisa que não é objeto vira um estado vazio utilizável", () => {
    for (const junk of [null, 42, "texto", [1, 2]]) {
      const r = repairState(junk, fallback);
      expect(r.state.profile.displayName).toBe("");
      expect(r.state.plan).toBeNull();
    }
  });

  it("descarta itens sem o mínimo para as contas e mantém os bons", () => {
    const seed = JSON.parse(JSON.stringify(makeSeed()));
    const good = seed.transactions[0];
    seed.transactions = [good, { id: "x" }, { ...good, id: "y", amount: "100" }, null];
    const r = repairState(seed, fallback);
    expect(r.state.transactions).toEqual([good]);
    expect(r.dropped).toBe(3);
  });

  it("listas e objetos com tipo errado voltam ao padrão", () => {
    const seed = JSON.parse(JSON.stringify(makeSeed()));
    seed.accounts = "nada";
    seed.stats = 7;
    seed.plan = { inputs: "quebrado" };
    const r = repairState(seed, fallback);
    expect(r.state.accounts).toEqual([]);
    expect(r.state.stats).toEqual(fallback.stats);
    expect(r.state.plan).toBeNull();
    expect(r.reset).toEqual(expect.arrayContaining(["accounts", "stats", "plan"]));
  });

  it("perfil incompleto ganha os campos padrão", () => {
    const seed = JSON.parse(JSON.stringify(makeSeed()));
    seed.profile = { displayName: "Bia" };
    const r = repairState(seed, fallback);
    expect(r.state.profile.displayName).toBe("Bia");
    expect(r.state.profile.reminderDay).toBe(fallback.profile.reminderDay);
  });
});
