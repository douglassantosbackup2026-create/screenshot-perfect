// Reserva de emergência: quantos meses do custo essencial o dinheiro guardado cobre.
// Funções puras. O custo essencial é a média mensal do que não dá para cortar (moradia, mercado,
// contas fixas…); quem escolhe o que entra é quem chama.

export const RESERVE_MONTHS = 6;

/** Média mensal de gastos (centavos positivos) nos meses dados; meses sem gasto contam como zero. */
export function averageMonthlySpending(items: { date: string; amount: number }[], months: string[]): number {
  if (!months.length) return 0;
  const keys = new Set(months.map((m) => m.slice(0, 7)));
  const total = items.reduce((t, it) => (keys.has(it.date.slice(0, 7)) ? t - it.amount : t), 0);
  return Math.max(Math.round(total / months.length), 0);
}

export type EmergencyFund = {
  monthlyEssential: number; // centavos
  target: number;           // centavos: meses × custo essencial
  current: number;          // centavos guardados
  missing: number;          // centavos que faltam (0 se já chegou)
  pct: number;              // 0 a 1
  monthsCovered: number;    // quantos meses o guardado paga, com uma casa decimal
}

export function emergencyFund(monthlyEssential: number, current: number, months = RESERVE_MONTHS): EmergencyFund {
  const target = Math.max(monthlyEssential, 0) * months;
  const saved = Math.max(current, 0);
  return {
    monthlyEssential,
    target,
    current: saved,
    missing: Math.max(target - saved, 0),
    pct: target > 0 ? Math.min(saved / target, 1) : 0,
    monthsCovered: monthlyEssential > 0 ? Math.floor((saved / monthlyEssential) * 10) / 10 : 0,
  };
}
