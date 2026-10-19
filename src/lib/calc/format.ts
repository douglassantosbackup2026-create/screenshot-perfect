const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

// Valores mensais: arredonda para R$ 10. Patrimônio: arredonda para R$ 1.000.
export const formatMonthly = (v: number) => brl.format(Math.round(v / 10) * 10);
export const formatWealth = (v: number) => brl.format(Math.round(v / 1000) * 1000);
export const formatPercent = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v);
export const formatAge = (age: number) => `${Math.floor(age)} anos`;
