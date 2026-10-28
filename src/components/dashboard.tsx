// Peças do painel (Hoje e Evolução): indicadores, gráficos, medidor e listas.
// Só exibem números; toda conta vem de src/lib/calc.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDashed,
  Landmark,
  Mountain,
  Shield,
  Target,
  TrendingUp,
  Umbrella,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, GRID, TOOLTIP_STYLE } from "@/components/chart-theme";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { DestinationShare, MonthlyAmount } from "@/lib/calc/progress";
import { goalProgress } from "@/lib/calc/progress";
import { formatMonthly, formatPercent, formatWealth } from "@/lib/calc/format";
import { DESTINATIONS, formatDate, HIDDEN, monthShort, monthYear } from "@/lib/labels";
import type { ActivityItem } from "@/lib/data/selectors";
import type { Destination, Goal } from "@/lib/data/demo-store";

type AppPath = "/hoje" | "/plano" | "/evolucao" | "/diario" | "/perfil" | "/patrimonio";

const signedPercent = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + formatPercent(Math.abs(v));

/** Selo de variação: amarelo para alta, cinza para queda. */
export function DeltaChip({ value, suffix }: { value: number; suffix?: string }) {
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        up ? "bg-primary/15 text-primary" : "bg-white/10 text-muted-foreground",
      )}
    >
      <Icon size={12} strokeWidth={2.25} aria-hidden />
      <span className="money">{signedPercent(value)}</span>
      {suffix && <span className="font-normal opacity-80">{suffix}</span>}
    </span>
  );
}

/** Indicador com seta no canto que leva à tela relacionada. */
export function StatCard({
  label,
  value,
  footer,
  to,
  icon: Icon,
  className,
}: {
  label: string;
  value: ReactNode;
  footer?: ReactNode;
  to: AppPath;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("relative flex min-h-[132px] flex-col rounded-2xl bg-card p-4 shadow-card", className)}>
      <div className="flex items-start justify-between gap-2 pr-10">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {Icon && <Icon size={16} strokeWidth={1.75} aria-hidden />}
          {label}
        </span>
      </div>
      <Link
        to={to}
        aria-label={`Abrir ${label}`}
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
      >
        <ArrowUpRight size={16} strokeWidth={2} aria-hidden />
      </Link>
      <div className="money mt-auto pt-4 font-display text-[28px] font-bold leading-none">{value}</div>
      {footer && <div className="mt-2 text-xs text-muted-foreground">{footer}</div>}
    </div>
  );
}

/** Cartão de gráfico com título e ação à direita. */
export function ChartCard({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl bg-card p-5 shadow-card", className)} aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const compact = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} mi` : v >= 1e3 ? `${Math.round(v / 1e3)} mil` : String(Math.round(v)));

/** Barras de aporte por mês com a meta do plano tracejada. O mês atual fica em amarelo cheio. */
export function ContributionsChart({ series, target, showValues }: { series: MonthlyAmount[]; target: number | null; showValues: boolean }) {
  const data = series.map((p) => ({ label: monthShort(p.month), amount: p.amount }));
  const top = Math.max(...series.map((p) => p.amount), target ?? 0, 1) * 1.15;
  return (
    <figure>
      <div className="h-56 w-full" aria-hidden>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis
              domain={[0, top]}
              width={showValues ? 44 : 4}
              tick={showValues ? AXIS_TICK : false}
              tickLine={false}
              axisLine={false}
              tickFormatter={compact}
            />
            {showValues && (
              <Tooltip
                cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
                formatter={(v: number) => [formatMonthly(v), "Aporte"]}
                contentStyle={TOOLTIP_STYLE}
              />
            )}
            <Bar dataKey="amount" radius={[8, 8, 8, 8]} maxBarSize={36} isAnimationActive={false}>
              {data.map((_, i) => (
                <Cell key={i} fill="var(--primary)" fillOpacity={i === data.length - 1 ? 1 : 0.45} />
              ))}
            </Bar>
            {target !== null && target > 0 && (
              <ReferenceLine
                y={target}
                stroke="var(--primary)"
                strokeDasharray="6 6"
                label={{
                  value: showValues ? `meta ${formatMonthly(target)}` : "meta",
                  position: "insideTopLeft",
                  fill: "var(--primary)",
                  fontSize: 12,
                }}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-sm text-muted-foreground">
        Barras: aporte registrado em cada mês. {target ? "Tracejado: aporte que o plano pede no cenário central." : ""}
      </figcaption>
    </figure>
  );
}

const DEST_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const destinationLabel = (d: string | null) => DESTINATIONS.find((x) => x.value === d)?.label ?? "Não informado";

/** Rosca com a divisão dos aportes por destino. */
export function DestinationDonut({ data, showValues }: { data: DestinationShare[]; showValues: boolean }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Informe o valor e o destino ao registrar um aporte para ver a divisão aqui.</p>;
  }
  const top = data[0]!;
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row lg:flex-col">
      <div className="relative h-44 w-44 shrink-0" aria-hidden>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data.map((d) => ({ name: destinationLabel(d.destination), value: d.amount }))}
              dataKey="value"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={3}
              cornerRadius={6}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={DEST_COLORS[i % DEST_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted-foreground">Mais usado</span>
          <span className="font-semibold">{destinationLabel(top.destination)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2.5 text-sm">
        {data.map((d, i) => (
          <li key={d.destination ?? "none"} className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DEST_COLORS[i % DEST_COLORS.length] }} aria-hidden />
            <span className="flex-1">{destinationLabel(d.destination)}</span>
            {showValues && <span className="money text-muted-foreground">{formatWealth(d.amount)}</span>}
            <span className="money w-14 text-right font-semibold">{formatPercent(d.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Medidor em semicírculo com marcações; as preenchidas usam a cor do texto. */
export function Gauge({ ratio, className }: { ratio: number; className?: string }) {
  const ticks = 44;
  const filled = Math.round(Math.min(Math.max(ratio, 0), 1) * ticks);
  return (
    <svg viewBox="0 0 240 128" className={cn("w-full", className)} aria-hidden>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const a = Math.PI - (i / ticks) * Math.PI;
        const r1 = 92;
        const r2 = i % 4 === 0 ? 116 : 110;
        const on = i <= filled && filled > 0;
        return (
          <line
            key={i}
            x1={120 + r1 * Math.cos(a)}
            y1={120 - r1 * Math.sin(a)}
            x2={120 + r2 * Math.cos(a)}
            y2={120 - r2 * Math.sin(a)}
            stroke="currentColor"
            strokeOpacity={on ? 1 : 0.22}
            strokeWidth={i % 4 === 0 ? 4 : 3}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

const DEST_ICONS: Record<Destination, LucideIcon> = {
  previdencia: Shield,
  investimentos: TrendingUp,
  reserva: Umbrella,
  outro: Wallet,
};

function activityIcon(item: ActivityItem): LucideIcon {
  if (item.kind === "patrimonio") return Landmark;
  if (item.kind === "meta") return Target;
  if (item.kind === "desafio") return Mountain;
  return item.destination ? DEST_ICONS[item.destination] : CircleDashed;
}

function activitySubtitle(item: ActivityItem) {
  if (item.kind === "aporte") return `${destinationLabel(item.destination)} · ${monthYear(item.month!).toLowerCase()}`;
  if (item.kind === "patrimonio") return monthYear(item.month!).toLowerCase();
  return `${item.kind === "meta" ? "Meta concluída" : "Desafio concluído"} · ${formatDate(item.at)}`;
}

/** Lista de atividades com ícone, descrição e valor à direita. */
export function ActivityList({
  items,
  showValues,
  empty,
  action,
}: {
  items: ActivityItem[];
  showValues: boolean;
  empty?: string;
  action?: (item: ActivityItem) => ReactNode;
}) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty ?? "Nada registrado ainda."}</p>;
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const Icon = activityIcon(item);
        const title = item.kind === "aporte" ? "Aporte" : item.kind === "patrimonio" ? "Patrimônio" : item.title;
        return (
          <li key={item.key} className="flex items-center gap-3 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
              <Icon size={18} strokeWidth={1.75} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{title}</p>
              <p className="truncate text-xs text-muted-foreground">{activitySubtitle(item)}</p>
            </div>
            {item.amount !== null && (
              <div className="text-right">
                <p className="money text-sm font-semibold">
                  {showValues ? (item.kind === "aporte" ? `+${formatMonthly(item.amount)}` : formatWealth(item.amount)) : HIDDEN}
                </p>
                {showValues && item.delta !== null && (
                  <p className="money text-xs text-muted-foreground">
                    {(item.delta >= 0 ? "+" : "−") + formatWealth(Math.abs(item.delta))}
                  </p>
                )}
              </div>
            )}
            {action?.(item)}
          </li>
        );
      })}
    </ul>
  );
}

/** Meta com barra de progresso e os valores das pontas. */
export function GoalCard({
  goal,
  wealth,
  showValues,
  onComplete,
  onDelete,
}: {
  goal: Goal;
  wealth: number;
  showValues: boolean;
  onComplete: () => void;
  onDelete: () => void;
}) {
  const ratio = goal.kind === "valor" && goal.target ? goalProgress(wealth, goal.target) : null;
  const money = (v: number) => (showValues ? formatWealth(v) : HIDDEN);
  return (
    <li className="rounded-2xl bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Target size={18} strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{goal.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {goal.kind === "valor" ? "Meta de valor" : "Meta de hábito"}
            {goal.deadline && ` · até ${monthYear(goal.deadline).toLowerCase()}`}
          </p>
        </div>
        {ratio !== null && (
          <span className="money rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">{formatPercent(ratio)}</span>
        )}
      </div>
      {ratio !== null && (
        <>
          <Progress value={ratio * 100} className="mt-4" aria-label={`Progresso da meta ${goal.title}`} />
          <div className="money mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{money(wealth)}</span>
            <span>{money(goal.target!)}</span>
          </div>
        </>
      )}
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" onClick={onComplete}>
          Concluí
        </Button>
        <ConfirmButton size="sm" confirmLabel="Confirmar exclusão" onConfirm={onDelete}>
          Excluir
        </ConfirmButton>
      </div>
    </li>
  );
}
