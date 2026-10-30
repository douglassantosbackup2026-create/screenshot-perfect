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
