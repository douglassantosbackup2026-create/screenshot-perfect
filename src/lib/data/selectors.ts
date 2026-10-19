import { simulateAll } from "@/lib/calc/retirement";
import { isoWeekKey, monthOf, spDate, weekStartOf } from "@/lib/gamification/rules";
import { MISSIONS } from "@/content/missions";
import type { DemoState } from "./demo-store";

/** Missão da semana: segue a ordem e recomeça quando a lista termina. */
export function missionOfWeek(s: DemoState, now = new Date()) {
  const week = isoWeekKey(weekStartOf(spDate(now)));
  const doneThisWeek = s.missionCompletions.find((m) => m.isoWeek === week);
  const idx = (s.missionCompletions.length - (doneThisWeek ? 1 : 0)) % MISSIONS.length;
  return { mission: MISSIONS[idx] ?? MISSIONS[0]!, done: !!doneThisWeek };
}

export function hasMonthRecord(s: DemoState, now = new Date()) {
  const m = monthOf(spDate(now));
  return s.contributions.some((c) => c.month === m);
}

export function planSummary(s: DemoState) {
  if (!s.plan) return null;
  const r = simulateAll(s.plan.inputs).semInss.central;
  return { required: r.requiredMonthlyContribution, current: s.plan.inputs.monthlyContribution, result: r };
}
