import { describe, expect, it } from "vitest";
import { OF_PREFIX, openingBalanceFor, syncSince, toImportedRows } from "./bankSync";
import { dedupe } from "./import";
import { mockTransactions } from "@/lib/openfinance/mock";

const tx = (id: string, amountCents: number, date = "2026-10-10", description = "MERCADO") => ({ id, date, amountCents, description, memo: null });

describe("toImportedRows", () => {
  it("vira linha de importação com id prefixado; zero e data inválida ficam de fora", () => {
    const rows = toImportedRows([tx("1", -3290), tx("2", 0), { ...tx("3", 100), date: "10/10/2026" }, tx("4", 500, "2026-10-11", "  ")]);
    expect(rows).toEqual([
      { importedId: `${OF_PREFIX}1`, date: "2026-10-10", amount: -3290, payee: "MERCADO", memo: null },
      { importedId: `${OF_PREFIX}4`, date: "2026-10-11", amount: 500, payee: "Lançamento do banco", memo: null },
    ]);
  });

  it("sincronizar de novo o mesmo período não duplica (o id do banco é o identificador)", () => {
    const first = toImportedRows([tx("a", -100), tx("b", -200)]);
    const existing = first.map((r, i) => ({ id: `t${i}`, date: r.date, amount: r.amount, payee: r.payee, importedId: r.importedId, imported: true }));
    const again = dedupe(toImportedRows([tx("a", -100), tx("b", -200), tx("c", -300)]), existing);
    expect(again.fresh.map((r) => r.importedId)).toEqual([`${OF_PREFIX}c`]);
    expect(again.duplicates).toHaveLength(2);
  });
});

describe("saldo e período", () => {
  it("saldo inicial faz o saldo do app bater com o do banco", () => {
    expect(openingBalanceFor(352_090, [tx("1", 650_000), tx("2", -180_000)])).toBe(352_090 - 470_000);
  });
  it("primeira vez: 90 dias; depois, desde o dia da última", () => {
    expect(syncSince("2026-10-30", null)).toBe("2026-08-01");
    expect(syncSince("2026-10-30", "2026-10-28T09:00:00Z")).toBe("2026-10-28");
  });
});

describe("provedor de teste", () => {
  it("ids estáveis e só dentro do período", () => {
    const a = mockTransactions("item1", "cc", "2026-09-06", "2026-10-30");
    expect(a.every((t) => t.date >= "2026-09-06" && t.date <= "2026-10-30")).toBe(true);
    expect(a.map((t) => t.id)).toEqual(mockTransactions("item1", "cc", "2026-09-06", "2026-10-30").map((t) => t.id));
    expect(a.map((t) => t.date)).toEqual(["2026-09-07", "2026-09-10", "2026-09-15", "2026-10-05", "2026-10-07", "2026-10-10", "2026-10-15"]);
  });
});
