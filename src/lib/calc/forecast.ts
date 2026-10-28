// Fim do mês: o saldo de hoje mais o que ainda está agendado para entrar, menos o que está agendado para sair.
// Função pura, valores em centavos. Só entra o que está agendado (recorrências e parcelas);
// gastos do dia a dia que ainda vão acontecer não são adivinhados.

export type ScheduledFlow = {
  date: string;   // "YYYY-MM-DD"
  amount: number; // centavos, com sinal
  label: string;
}

export type MonthEndProjection = {
  start: number;       // saldo hoje
  inflows: number;     // entradas agendadas até o fim do mês, positivo
  outflows: number;    // saídas agendadas até o fim do mês, positivo
  projected: number;   // saldo previsto no último dia
  lowestPoint: number; // menor saldo do caminho (pode ser o de hoje)
  lowestDate: string;  // dia do menor saldo
  flows: ScheduledFlow[];
}

/** Caminho do saldo de `today` (exclusive) até `monthEnd` (inclusive), dia a dia. */
export function monthEndProjection(balanceToday: number, today: string, monthEnd: string, flows: ScheduledFlow[]): MonthEndProjection {
  const inRange = flows.filter((f) => f.date > today && f.date <= monthEnd).sort((a, b) => a.date.localeCompare(b.date));
  let balance = balanceToday;
  let lowestPoint = balanceToday;
  let lowestDate = today;
  let inflows = 0;
  let outflows = 0;
  for (let i = 0; i < inRange.length; i++) {
    const f = inRange[i]!;
    balance += f.amount;
    if (f.amount >= 0) inflows += f.amount;
    else outflows -= f.amount;
    const lastOfDay = inRange[i + 1]?.date !== f.date; // entradas e saídas do mesmo dia se compensam
    if (lastOfDay && balance < lowestPoint) {
      lowestPoint = balance;
      lowestDate = f.date;
    }
  }
  return { start: balanceToday, inflows, outflows, projected: balance, lowestPoint, lowestDate, flows: inRange };
}
