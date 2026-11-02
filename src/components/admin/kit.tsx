// Peças comuns do painel administrativo: período, carregamento, números em destaque, gráficos de uma série
// e barras horizontais. Gráficos de uma série só (cor principal, sem legenda: o título diz o que é), com dica
// ao passar o mouse e tabela por baixo quando o número exato importa.
import type { ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, GRID, TOOLTIP_STYLE } from "@/components/chart-theme";
import { Input } from "@/components/ui/input";
import { formatCount, formatDelta } from "@/lib/calc/business";
import { daysAgo, type Period } from "./hooks";
import { cn } from "@/lib/utils";

/** 7, 30 ou 90 dias, ou datas escolhidas. */
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const presets = [7, 30, 90];
  const active = presets.find((d) => value.from === daysAgo(d - 1) && value.to === daysAgo(0));
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex rounded-full bg-muted p-1" role="group" aria-label="Período">
        {presets.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={active === d}
            onClick={() => onChange({ from: daysAgo(d - 1), to: daysAgo(0) })}
            className={cn(
              "min-h-11 rounded-full px-4 text-sm",
              active === d ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {d} dias
          </button>
        ))}
      </div>
      <label className="text-xs text-muted-foreground">
        De
        <Input type="date" className="mt-1 h-11 w-40" value={value.from} max={value.to} onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })} />
      </label>
      <label className="text-xs text-muted-foreground">
        Até
        <Input type="date" className="mt-1 h-11 w-40" value={value.to} min={value.from} onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })} />
      </label>
    </div>
  );
}

export function AdminPage({ title, intro, actions, children }: { title: string; intro?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1>{title}</h1>
          {intro && <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{intro}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-6 space-y-6">{children}</div>
    </div>
  );
}

/** Enquanto carrega; se a carga falhou, diz isso e oferece tentar de novo (em vez de carregar para sempre). */
export function Loading({ failed, onRetry }: { failed?: boolean; onRetry?: () => void }) {
  if (failed)
    return (
      <div role="alert" className="rounded-2xl bg-card p-5 text-sm shadow-card">
        <p>Não foi possível carregar estes dados agora.</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="mt-2 min-h-11 font-semibold text-primary">
            Tentar de novo
          </button>
        )}
      </div>
    );
  return <div className="h-40 animate-pulse rounded-2xl bg-card" aria-busy="true" aria-label="Carregando" />;
}

export function Card({ title, note, children, className }: { title?: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl bg-card p-5 shadow-card", className)} aria-label={title}>
      {title && <h2 className="text-base">{title}</h2>}
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      <div className={title || note ? "mt-3" : ""}>{children}</div>
    </section>
  );
}

/** Número em destaque, com variação contra o período anterior e de onde vem o dado. */
export function Stat({ label, value, delta, note, alert }: { label: string; value: string; delta?: number | null; note?: string; alert?: boolean }) {
  return (
    <div className={cn("rounded-2xl bg-card p-4 shadow-card", alert && "ring-1 ring-destructive")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("money mt-1 font-display text-2xl font-semibold", alert && "text-destructive")}>{value}</p>
      {delta !== undefined && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className={cn(delta !== null && delta > 0 && "text-primary", delta !== null && delta < 0 && "text-destructive")}>{formatDelta(delta)}</span> vs. período anterior
        </p>
      )}
      {note && <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

export const StatGrid = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{children}</div>;

const dayLabel = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Uma série por dia, em área (cor principal). */
export function DailyChart({ rows, field, label }: { rows: Record<string, unknown>[]; field: string; label: string }) {
  const data = rows.map((r) => ({ day: String(r["day"]).slice(0, 10), v: Number(r[field] ?? 0) }));
  return (
    <figure>
      <div className="h-44 w-full" aria-hidden>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="day" tickFormatter={dayLabel} tick={AXIS_TICK} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis width={36} allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v: number) => [v.toLocaleString("pt-BR"), label]} labelFormatter={(d) => dayLabel(String(d))} contentStyle={TOOLTIP_STYLE} />
            <Area type="monotone" dataKey="v" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {label} por dia: {data.map((d) => `${dayLabel(d.day)} ${d.v}`).join(", ")}
      </figcaption>
    </figure>
  );
}

/** Barras horizontais de uma cor só (contagens ou funil), com o número escrito ao lado. */
export function Bars({ rows, total }: { rows: { label: string; value: number | null }[]; total?: number | undefined }) {
  const max = total ?? Math.max(1, ...rows.map((r) => r.value ?? 0));
  if (!rows.length) return <p className="text-sm text-muted-foreground">Sem dados no período.</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex justify-between gap-4 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="money shrink-0 text-muted-foreground">{formatCount(r.value)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden>
            <div className="h-2 rounded-full bg-primary" style={{ width: `${r.value ? Math.max((r.value / max) * 100, 2) : 0}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tabela simples que rola na horizontal dentro do próprio cartão (a página nunca rola de lado). */
export function Table({ head, rows, empty = "Nada por aqui." }: { head: string[]; rows: ReactNode[][]; empty?: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="py-2 pr-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="py-2 pr-3 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const STATUS_PILL = "inline-block rounded-full bg-muted px-2 py-0.5 text-xs";
