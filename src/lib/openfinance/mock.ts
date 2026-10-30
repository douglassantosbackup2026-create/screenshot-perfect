// Provedor de teste: um "banco" com conta corrente e cartão, lançamentos fixos por dia. Serve para
// desenvolver e testar o fluxo (conectar, sincronizar, não duplicar) sem contratar um agregador.
import type { OpenFinanceProvider, ProviderAccount, ProviderTx } from "./provider";

const ACCOUNTS: ProviderAccount[] = [
  { id: "cc", name: "Banco Teste · Conta corrente", kind: "corrente", balanceCents: 352_090 },
  { id: "cartao", name: "Banco Teste · Cartão", kind: "cartao", balanceCents: -84_350 },
];

const PATTERN: { accountId: string; day: number; amountCents: number; description: string }[] = [
  { accountId: "cc", day: 5, amountCents: 650_000, description: "PIX RECEBIDO CLIENTE" },
  { accountId: "cc", day: 7, amountCents: -180_000, description: "ALUGUEL" },
  { accountId: "cc", day: 10, amountCents: -32_990, description: "SUPERMERCADO BOM PRECO" },
  { accountId: "cc", day: 15, amountCents: -12_000, description: "CONTA DE LUZ" },
  { accountId: "cartao", day: 3, amountCents: -4_590, description: "STREAMING" },
  { accountId: "cartao", day: 12, amountCents: -8_740, description: "FARMACIA SAO JOAO" },
  { accountId: "cartao", day: 20, amountCents: -23_000, description: "RESTAURANTE" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Lançamentos do padrão de `since` até hoje, com id estável (o mesmo lançamento tem sempre o mesmo id). */
export function mockTransactions(itemId: string, accountId: string, since: string, today = iso(new Date())): ProviderTx[] {
  const out: ProviderTx[] = [];
  const start = new Date(since + "T12:00:00Z");
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1, 12));
  while (iso(cursor) <= today) {
    for (const p of PATTERN.filter((x) => x.accountId === accountId)) {
      const date = iso(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), p.day, 12)));
      if (date < since || date > today) continue;
      out.push({ id: `${itemId}-${accountId}-${date}-${p.day}`, accountId, date, amountCents: p.amountCents, description: p.description, memo: null });
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

export const mockProvider: OpenFinanceProvider = {
  name: "mock",
  createConnectToken: async (userId) => `mock-token-${userId}`,
  listAccounts: async () => ACCOUNTS.map((a) => ({ ...a })),
  listTransactions: async (itemId, accountId, since) => mockTransactions(itemId, accountId, since),
  parseWebhook: (body) => {
    const b = (body ?? {}) as Record<string, unknown>;
    const event = b["event"];
    if (typeof b["itemId"] !== "string" || (event !== "atualizado" && event !== "erro" && event !== "revogado")) return null;
    return { itemId: b["itemId"], event };
  },
};
