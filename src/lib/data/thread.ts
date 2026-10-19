import { addMonths, monthOf, spDate } from "@/lib/gamification/rules";
import type { Contribution } from "./demo-store";

export type MonthState = "aporte" | "sem_aporte" | "vazio";

/** Meses do primeiro registro até o atual, do mais recente para o mais antigo. */
export function threadMonths(contribs: Contribution[], now = new Date()): { month: string; state: MonthState; items: Contribution[] }[] {
  const current = monthOf(spDate(now));
  if (!contribs.length) return [];
  const first = contribs.map((c) => c.month).sort()[0] ?? current;
  const out: { month: string; state: MonthState; items: Contribution[] }[] = [];
  for (let m = current; m >= first; m = addMonths(m, -1)) {
    const items = contribs.filter((c) => c.month === m);
    const state: MonthState = items.some((c) => c.made) ? "aporte" : items.length ? "sem_aporte" : "vazio";
    out.push({ month: m, state, items });
  }
  return out;
}

/** Últimos N meses (do mais antigo ao atual) para o fio resumido. */
export function lastMonths(contribs: Contribution[], n: number, now = new Date()) {
  const current = monthOf(spDate(now));
  return Array.from({ length: n }, (_, i) => {
    const m = addMonths(current, i - n + 1);
    const items = contribs.filter((c) => c.month === m);
    const state: MonthState = items.some((c) => c.made) ? "aporte" : items.length ? "sem_aporte" : "vazio";
    return { month: m, state };
  });
}
