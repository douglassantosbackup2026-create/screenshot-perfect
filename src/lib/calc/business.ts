// Contas do painel administrativo: variações, taxas e faixas. Funções puras; os totais vêm do banco
// (admin_overview, admin_billing…). As faixas são o que a calculadora envia no lugar do valor digitado.

/** Variação contra o período anterior (0,25 = +25%); null quando não há base para comparar. */
export function delta(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return (current - previous) / previous;
}

/** Parte sobre o todo (0 a 1); null quando o todo é zero. */
export function rate(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  return Math.min(Math.max(part / whole, 0), 1);
}

/** Cancelamentos do período sobre os assinantes ativos no início dele. */
export const churn = (cancellations: number, activeAtStart: number) => rate(cancellations, activeAtStart);

/** "+12%", "−3%", "—" (sem base). */
export function formatDelta(d: number | null): string {
  if (d === null) return "—";
  const pct = Math.round(d * 100);
  if (pct === 0) return "0%";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`;
}

/** "42%", "—". */
export function formatRate(r: number | null): string {
  return r === null ? "—" : `${Math.round(r * 100)}%`;
}

/** Contagem com proteção de privacidade: o banco devolve null quando são menos de 5 pessoas. */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "<5";
  return Math.round(n).toLocaleString("pt-BR");
}

// ---------- faixas (o painel nunca recebe o número digitado) ----------
const band = (v: number, edges: number[], labels: string[]) => {
  const i = edges.findIndex((e) => v < e);
  return labels[i === -1 ? labels.length - 1 : i]!;
};

export const AGE_BANDS = ["até 29", "30–39", "40–49", "50–59", "60+"];
export const ageBand = (age: number) => band(age, [30, 40, 50, 60], AGE_BANDS);

export const INCOME_BANDS = ["até R$ 3 mil", "R$ 3–6 mil", "R$ 6–10 mil", "R$ 10–20 mil", "acima de R$ 20 mil"];
export const incomeBand = (reais: number) => band(reais, [3000, 6000, 10000, 20000], INCOME_BANDS);

export const MONTHLY_BANDS = ["até R$ 500", "R$ 500–1,5 mil", "R$ 1,5–3 mil", "R$ 3–6 mil", "acima de R$ 6 mil"];
export const monthlyBand = (reais: number) => band(reais, [500, 1500, 3000, 6000], MONTHLY_BANDS);
