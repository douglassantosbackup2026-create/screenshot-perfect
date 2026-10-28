// Lançamentos recorrentes: datas das ocorrências e ajuste de fim de semana. Funções puras.
// Cada ocorrência tem uma data nominal (a da regra) e uma data efetiva (depois do ajuste).
// A data nominal identifica a ocorrência: gerar duas vezes não duplica (único por regra + data nominal).
// Mesma conta do SQL: a k-ésima data é sempre calculada a partir do início (dia 31 vira o último dia do mês).

export type Frequency = 'semanal' | 'mensal' | 'anual';
export type WeekendRule = 'manter' | 'antes' | 'depois';

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'semanal', label: 'Toda semana' },
  { value: 'mensal', label: 'Todo mês' },
  { value: 'anual', label: 'Todo ano' },
];

export type RecurrenceRule = {
  startDate: string; // "YYYY-MM-DD"
  frequency: Frequency;
  interval: number;  // a cada N semanas, meses ou anos (>= 1)
  endDate: string | null;
  weekend: WeekendRule;
}

export type Occurrence = {
  occurrenceDate: string; // data nominal
  date: string;           // data efetiva, depois do ajuste de fim de semana
}

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const daysInMonth = (y: number, m0: number) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function validateRule(r: RecurrenceRule): string[] {
  const e: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.startDate)) e.push('Informe a data da primeira vez.');
  if (!(Number.isInteger(r.interval) && r.interval >= 1 && r.interval <= 52)) e.push('O intervalo vai de 1 a 52.');
  if (r.endDate && r.endDate < r.startDate) e.push('A data final vem antes da primeira.');
  return e;
}

/** Data nominal da k-ésima ocorrência (k = 0 é a primeira). */
export function nominalDate(r: RecurrenceRule, k: number): string {
  const y = Number(r.startDate.slice(0, 4));
  const m0 = Number(r.startDate.slice(5, 7)) - 1;
  const d = Number(r.startDate.slice(8, 10));
  if (r.frequency === 'semanal') return addDays(r.startDate, 7 * r.interval * k);
  if (r.frequency === 'mensal') {
    const total = m0 + r.interval * k;
    const yy = y + Math.floor(total / 12);
    const mm = total - Math.floor(total / 12) * 12;
    return iso(yy, mm, Math.min(d, daysInMonth(yy, mm)));
  }
  const yy = y + r.interval * k;
  return iso(yy, m0, Math.min(d, daysInMonth(yy, m0)));
}

/** Leva sábado e domingo para a sexta anterior ou a segunda seguinte. */
export function adjustWeekend(date: string, rule: WeekendRule): string {
  if (rule === 'manter') return date;
  const dow = new Date(date + 'T00:00:00Z').getUTCDay(); // 0 domingo, 6 sábado
  if (dow === 6) return addDays(date, rule === 'antes' ? -1 : 2);
  if (dow === 0) return addDays(date, rule === 'antes' ? -2 : 1);
  return date;
}

/** Ocorrências com data efetiva até `until` (inclusive), respeitando a data final da regra. */
export function occurrencesUntil(r: RecurrenceRule, until: string, limit = 1000): Occurrence[] {
  const out: Occurrence[] = [];
  // Uma ocorrência de sábado pode ser antecipada para sexta: olha dois dias adiante.
  const horizon = addDays(until, 2);
  for (let k = 0; k < limit; k++) {
    const occurrenceDate = nominalDate(r, k);
    if (occurrenceDate > horizon || (r.endDate && occurrenceDate > r.endDate)) break;
    const date = adjustWeekend(occurrenceDate, r.weekend);
    if (date <= until) out.push({ occurrenceDate, date });
  }
  return out;
}

/** Ocorrências que já venceram (até hoje) e ainda não foram lançadas. */
export function dueOccurrences(r: RecurrenceRule, generated: ReadonlySet<string>, today: string): Occurrence[] {
  return occurrencesUntil(r, today).filter((o) => !generated.has(o.occurrenceDate));
}

/** Próxima ocorrência com data efetiva depois de `after`; null se a regra já terminou. */
export function nextOccurrence(r: RecurrenceRule, after: string, limit = 1000): Occurrence | null {
  for (let k = 0; k < limit; k++) {
    const occurrenceDate = nominalDate(r, k);
    if (r.endDate && occurrenceDate > r.endDate) return null;
    const date = adjustWeekend(occurrenceDate, r.weekend);
    if (date > after) return { occurrenceDate, date };
  }
  return null;
}
