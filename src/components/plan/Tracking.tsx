// Projetado × real: o patrimônio registrado dentro do corredor da foto ancorada do plano.
// Só exibe números; toda conta vem de src/lib/calc/tracking.ts (via progressTracking).
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_TICK, GRID, TOOLTIP_STYLE } from "@/components/chart-theme";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChartCard } from "@/components/dashboard";
import { HIDDEN } from "@/lib/labels";
import { Blurred, useFeature } from "@/components/Upgrade";
import { demo, type DemoState } from "@/lib/data/demo-store";
import { progressTracking } from "@/lib/data/selectors";
import type { VerdictCode } from "@/lib/calc/tracking";
import { formatPercent, formatWealth } from "@/lib/calc/format";
import { formatDate, monthShort, monthYear } from "@/lib/labels";
import { cn } from "@/lib/utils";

const VERDICT: Record<VerdictCode, { label: string; detail: string; tone: string }> = {
  a_frente: {
    label: "À frente",
    detail: "Seu patrimônio está acima do cenário otimista do plano.",
    tone: "bg-primary text-primary-foreground",
  },
  no_ritmo: {
    label: "No ritmo",
    detail:
      "Seu patrimônio está dentro do corredor do plano, entre o cenário conservador e o otimista.",
    tone: "bg-primary/15 text-primary",
  },
  levemente_atras: {
    label: "Levemente atrás",
    detail:
      "Abaixo do corredor do plano, mas ainda dentro do ruído de curto prazo (menos de 7%). Vale acompanhar os próximos meses.",
    tone: "bg-muted text-foreground",
  },
  atras: {
    label: "Atrás",
    detail:
      "Abaixo do cenário conservador do plano por 7% ou mais. Rever o aporte ou as premissas pode ajudar.",
    tone: "bg-destructive/15 text-destructive",
  },
};

export function ProjectedVsReal({ s, showValues }: { s: DemoState; showValues: boolean }) {
  const t = progressTracking(s);
  const corridor = useFeature("progress_corridor");
  if (!t) return null;
  const money = (v: number) => (showValues ? formatWealth(v) : HIDDEN);
  const v = t.verdict;
  const data = t.points.map((p) => ({
    month: monthShort(p.month),
    band: [p.low, p.high],
    central: p.central,
    actual: p.actual,
  }));

  function reanchor() {
    demo.reanchor();
    toast("Pronto. A comparação agora usa a versão atual do plano.");
  }

  return (
    <ChartCard
      title="Projetado × real"
      className="lg:col-span-12"
      action={
        v &&
        corridor.allowed && (
          <span
            className={cn("rounded-full px-3 py-1 text-xs font-semibold", VERDICT[v.code].tone)}
          >
            {VERDICT[v.code].label}
          </span>
        )
      }
    >
      <Blurred feature="progress_corridor">
        <p className="text-sm text-muted-foreground">
          Comparando com o plano de {formatDate(t.anchor.createdAt)}. Essa é uma foto congelada: ela
          não muda quando você edita o plano depois.
        </p>
        {v ? (
          <>
            <p className="mt-3 text-sm">{VERDICT[v.code].detail}</p>
            <dl className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-muted p-3">
                <dt className="text-xs text-muted-foreground">Projetado · {monthShort(v.month)}</dt>
                <dd className="money font-display text-lg font-semibold">{money(v.central)}</dd>
              </div>
              <div className="rounded-2xl bg-muted p-3">
                <dt className="text-xs text-muted-foreground">Real · {monthShort(v.month)}</dt>
                <dd className="money font-display text-lg font-semibold">{money(v.actual)}</dd>
              </div>
              <div className="rounded-2xl bg-muted p-3">
                <dt className="text-xs text-muted-foreground">Desvio</dt>
                <dd
                  className={cn(
                    "money font-display text-lg font-semibold",
                    v.deviation < 0 && "text-destructive",
                  )}
                >
                  {showValues
                    ? (v.deviation < 0 ? "−" : "+") + formatWealth(Math.abs(v.deviation))
                    : HIDDEN}
                </dd>
              </div>
            </dl>
            {t.points.length > 1 && (
              <figure className="mt-4">
                <div className="h-48 w-full" aria-hidden>
                  <ResponsiveContainer>
                    <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid {...GRID} />
                      <XAxis
                        dataKey="month"
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        width={48}
                        hide={!showValues}
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(x: number) =>
                          x >= 1e6 ? `${(x / 1e6).toFixed(1)} mi` : `${Math.round(x / 1e3)} mil`
                        }
                      />
                      {showValues && (
                        <Tooltip
                          formatter={(x: number | number[], name: string) =>
                            Array.isArray(x)
                              ? [`${formatWealth(x[0]!)} a ${formatWealth(x[1]!)}`, "Corredor"]
                              : [formatWealth(x), name === "actual" ? "Real" : "Projetado"]
                          }
                          contentStyle={TOOLTIP_STYLE}
                        />
                      )}
                      <Area
                        dataKey="band"
                        stroke="none"
                        fill="var(--primary)"
                        fillOpacity={0.12}
                        isAnimationActive={false}
                      />
                      <Line
                        dataKey="central"
                        stroke="var(--muted-foreground)"
                        strokeDasharray="4 4"
                        dot={false}
                        isAnimationActive={false}
                      />
                      <Scatter dataKey="actual" fill="var(--primary)" isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <figcaption className="mt-2 text-xs text-muted-foreground">
                  Faixa: corredor do plano (conservador a otimista). Linha tracejada: cenário
                  central. Pontos: patrimônio para a aposentadoria que você registrou.
                </figcaption>
              </figure>
            )}
            {t.impact && t.impact.monthsLate !== 0 && (
              <p className="mt-4 text-sm">
                No ritmo atual, você chega à aposentadoria com{" "}
                {formatPercent(Math.abs(t.impact.deltaPct))}{" "}
                {t.impact.deltaPct < 0 ? "a menos" : "a mais"} que o planejado
                {t.impact.monthsLate > 0
                  ? ` (${t.impact.monthsLate} ${t.impact.monthsLate === 1 ? "mês" : "meses"} depois do previsto).`
                  : ` (daria para parar ${-t.impact.monthsLate} ${t.impact.monthsLate === -1 ? "mês" : "meses"} antes).`}
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm">
            Registre o patrimônio a partir de {monthYear(t.anchorMonth).toLowerCase()} para ver se
            você está no ritmo do plano.
          </p>
        )}
        {!t.isLatestPlan && (
          <div className="mt-4 rounded-2xl bg-muted p-3 text-sm">
            <p>
              Seu plano mudou desde essa foto. Se a mudança foi grande, compare com a versão atual.
            </p>
            <Button size="sm" variant="outline" className="mt-2" onClick={reanchor}>
              Comparar com o plano atual
            </Button>
          </div>
        )}
      </Blurred>
    </ChartCard>
  );
}
