// Open Finance: o que o app precisa de um agregador (Pluggy, Belvo…), sem depender de nenhum.
// Hoje só existe o provedor de teste (mock.ts); um provedor real é mais uma implementação desta interface.
import type { AccountKind } from "@/lib/calc/ledger";

export type ProviderName = "mock";

/** Conta como o agregador informa. Saldo em centavos, positivo = dinheiro da pessoa (no cartão, negativo = fatura). */
export type ProviderAccount = { id: string; name: string; kind: AccountKind; balanceCents: number };

/** Lançamento como o agregador informa. Centavos com sinal: entrada positiva, saída negativa. */
export type ProviderTx = { id: string; accountId: string; date: string; amountCents: number; description: string; memo: string | null };

export type WebhookEvent = { itemId: string; event: "atualizado" | "erro" | "revogado" };

export interface OpenFinanceProvider {
  name: ProviderName;
  /** Token para abrir o widget do agregador no navegador (a pessoa escolhe o banco e autoriza lá). */
  createConnectToken(userId: string): Promise<string>;
  /** Contas de uma conexão (item) autorizada. */
  listAccounts(itemId: string): Promise<ProviderAccount[]>;
  /** Lançamentos de uma conta a partir de `since` ("YYYY-MM-DD"). */
  listTransactions(itemId: string, accountId: string, since: string): Promise<ProviderTx[]>;
  /** Aviso do agregador (dados novos, erro, consentimento revogado); null se não for um aviso conhecido. */
  parseWebhook(body: unknown): WebhookEvent | null;
}

/** Provedor configurado no servidor (OPEN_FINANCE_PROVIDER); null quando o Open Finance está desligado. */
export async function providerFromEnv(): Promise<OpenFinanceProvider | null> {
  const name = process.env["OPEN_FINANCE_PROVIDER"];
  if (name === "mock") return (await import("./mock")).mockProvider;
  return null;
}
