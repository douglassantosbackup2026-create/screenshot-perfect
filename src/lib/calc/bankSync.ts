// Sincronização com o banco (Open Finance): do formato do agregador para o da importação de extrato.
// Funções puras. Centavos com sinal: entrada positiva, saída negativa.
import { IMPORT_LIMITS, type ImportedTx } from "./import";

/** O mínimo do agregador que a conversão usa (src/lib/openfinance/provider.ts). */
export type BankTx = { id: string; date: string; amountCents: number; description: string; memo: string | null };

/** Prefixo dos ids vindos do Open Finance: não se confundem com o FITID de um OFX importado à mão. */
export const OF_PREFIX = "of:";

/**
 * Lançamentos do banco → linhas da importação (dedupe e regras de categoria fazem o resto, como num OFX).
 * Valor zero e datas inválidas ficam de fora; textos são cortados nos limites do banco.
 */
export function toImportedRows(txs: BankTx[]): ImportedTx[] {
  return txs
    .filter((t) => Number.isInteger(t.amountCents) && t.amountCents !== 0 && /^\d{4}-\d{2}-\d{2}$/.test(t.date))
    .map((t) => ({
      importedId: (OF_PREFIX + t.id).slice(0, IMPORT_LIMITS.importedId),
      date: t.date,
      amount: t.amountCents,
      payee: t.description.trim().slice(0, IMPORT_LIMITS.payee) || "Lançamento do banco",
      memo: t.memo?.trim().slice(0, IMPORT_LIMITS.memo) || null,
    }));
}

/**
 * Saldo inicial de uma conta nova, para o saldo do app bater com o do banco depois de importar `txs`:
 * saldo de hoje menos tudo o que entrou e saiu no período importado.
 */
export function openingBalanceFor(balanceCents: number, txs: BankTx[]): number {
  return balanceCents - txs.reduce((t, x) => t + x.amountCents, 0);
}

/** Desde quando buscar: o dia da última sincronização (repete o dia, o dedupe ignora o que já veio) ou 90 dias atrás. */
export function syncSince(today: string, lastSyncedAt: string | null, firstDays = 90): string {
  if (lastSyncedAt) return lastSyncedAt.slice(0, 10);
  const d = new Date(today + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - firstDays);
  return d.toISOString().slice(0, 10);
}

/** Prefixo das "contas" que são investimentos no agregador (só saldo, sem lançamentos). */
export const INVESTMENT_PREFIX = "inv:";

/** Tipo de conta do Pluggy → tipo de conta do app. */
export function pluggyAccountKind(type: string, subtype: string | null): "corrente" | "poupanca" | "cartao" {
  if (type === "CREDIT" || subtype === "CREDIT_CARD") return "cartao";
  if (subtype === "SAVINGS_ACCOUNT") return "poupanca";
  return "corrente";
}

/** Investimento do Pluggy → previdência (PGBL/VGBL/fundo de pensão) ou investimento. */
export function pluggyInvestmentKind(type: string, name: string): "previdencia" | "investimento" {
  return type === "PENSION" || /\b(pgbl|vgbl|previd)/i.test(name) ? "previdencia" : "investimento";
}

/** Valor de um lançamento do Pluggy em centavos com sinal (saída negativa), qualquer que seja o sinal enviado. */
export function pluggyTxCents(amount: number, type: string | null): number {
  const cents = Math.round(Math.abs(amount) * 100);
  if (type === "DEBIT") return -cents;
  if (type === "CREDIT") return cents;
  return Math.round(amount * 100);
}

/** Saída de dinheiro que parece ir para previdência ou investimento: vira "Possível aporte". Só sugere, nunca registra. */
export function looksLikeContribution(amountCents: number, description: string): boolean {
  if (amountCents >= 0) return false;
  return /\b(pgbl|vgbl|previd[eê]ncia|prev\b|aplica[cç][aã]o|aplic\b|invest|tesouro|cdb|lci|lca|brasilprev|icatu|caixa vida)/i.test(description);
}

/** Saldo inicial que faz o saldo de uma conta só-saldo (investimento) bater com o do banco hoje. */
export function syncedOpeningBalance(balanceCents: number, existingAmounts: number[]): number {
  return balanceCents - existingAmounts.reduce((t, x) => t + x, 0);
}
