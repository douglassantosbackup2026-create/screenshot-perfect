const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

// Valores mensais: arredonda para R$ 10. Patrimônio: arredonda para R$ 1.000.
export const formatMonthly = (v: number) => brl.format(Math.round(v / 10) * 10);
export const formatWealth = (v: number) => brl.format(Math.round(v / 1000) * 1000);
export const formatPercent = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
export const formatAge = (age: number) => `${Math.floor(age)} anos`;
/** Idade com meses: 58.25 → "58 anos e 3 meses". */
export const formatAgeMonths = (age: number) => {
  const total = Math.round(age * 12);
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  return m === 0 ? `${y} anos` : `${y} anos e ${m} ${m === 1 ? "mês" : "meses"}`;
};

const brlExact = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Livro-caixa: valor exato, a partir de centavos.
// "+ 0" evita "-R$ 0,00" quando o valor é zero negativo.
export const formatMoney = (cents: number) => brlExact.format(cents / 100 + 0);
