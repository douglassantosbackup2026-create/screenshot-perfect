// Comissão de afiliado sobre um pagamento do indicado. Função pura; a fonte da verdade é o banco
// (_affiliate_commission em supabase/migrations/20261109120000_afiliados.sql), que segue esta regra.
// A tela do admin usa daqui para mostrar a simulação antes de aprovar.

export type CommissionMode = "primeiro" | "meses" | "sempre";

export type CommissionRule = {
  mode: CommissionMode;
  bp: number;            // basis points: 2000 = 20%
  months: number | null; // só no modo "meses"
};

export const DEFAULT_RULE: CommissionRule = { mode: "meses", bp: 2000, months: 12 };

export const MODE_LABEL: Record<CommissionMode, string> = {
  primeiro: "Só o 1º pagamento",
  meses: "Por alguns meses",
  sempre: "Enquanto pagar",
};

/** Soma meses de calendário; dia que não existe no mês final vira o último dia (como o Postgres). */
export function addMonths(iso: string, months: number): Date {
  const d = new Date(iso);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  target.setUTCHours(d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds());
  return target;
}

/**
 * Centavos de comissão (0 quando a regra não paga este pagamento).
 * `firstPaidAt`: primeiro pagamento do indicado depois da indicação (o próprio, se for o primeiro).
 * `previousCount`: comissões que esse indicado já gerou.
 */
export function commissionFor(
  rule: CommissionRule,
  p: { paymentCents: number; paidAt: string; firstPaidAt: string; previousCount: number },
): number {
  if (rule.mode === "primeiro" && p.previousCount > 0) return 0;
  if (rule.mode === "meses" && new Date(p.paidAt) >= addMonths(p.firstPaidAt, rule.months ?? 0)) return 0;
  const bp = Math.min(Math.max(Math.round(rule.bp), 0), 10000);
  return Math.round((Math.max(p.paymentCents, 0) * bp) / 10000);
}

/** "20%", "12,5%". */
export function formatRate(bp: number): string {
  return `${(bp / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** A regra em uma frase, para o afiliado e o admin. */
export function describeRule(rule: CommissionRule): string {
  const rate = formatRate(rule.bp);
  if (rule.mode === "primeiro") return `${rate} do primeiro pagamento de cada indicado`;
  if (rule.mode === "meses") return `${rate} de cada pagamento, nos primeiros ${rule.months} meses de cada indicado`;
  return `${rate} de cada pagamento, enquanto o indicado continuar pagando`;
}

/** Percentual digitado ("12,5") em basis points; null se não for um número entre 0 e 100. */
export function parseRate(text: string): number | null {
  const n = Number(text.replace(",", ".").trim());
  if (!text.trim() || !Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 100);
}
