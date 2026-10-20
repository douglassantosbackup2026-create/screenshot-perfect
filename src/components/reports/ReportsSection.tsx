// Relatórios do Progresso: fluxo de caixa, gastos por categoria e patrimônio por grupo.
// Só exibe; as contas vêm de src/lib/calc/reports.ts por src/lib/data/selectors.ts.
// Cores de série em --series-1..5 (src/styles.css), fixas por entidade; um só eixo por gráfico.
import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { usePlanAccess } from "@/lib/data/access";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Segmented } from "@/components/forms";
import { ChartCard, HIDDEN } from "@/components/dashboard";
import { formatMoney, formatPercent, formatWealth } from "@/lib/calc/format";
import type { DemoState } from "@/lib/data/demo-store";
import { reportsView } from "@/lib/data/selectors";
import { monthShort } from "@/lib/labels";

const PERIODS = [
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
] as const;
type Period = (typeof PERIODS)[number]["value"];

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];
const label = (m: string) => `${monthShort(m)}/${m.slice(2, 4)}`;
// Abaixo de 10 mil, uma casa decimal: 2.500 e 3.000 não podem virar os dois "3 mil".
const compact = (v: number) =>
  Math.abs(v) >= 1e6
    ? `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
    : Math.abs(v) >= 1e3
      ? `${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: Math.abs(v) < 1e4 ? 1 : 0 })} mil`
      : String(Math.round(v));
const tooltipStyle = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 };
const axis = { fontSize: 12, fill: "var(--muted-foreground)" };

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legenda">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Os mesmos números do gráfico, em tabela, para quem prefere ler (ou não distingue as cores). */
function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver em tabela</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left">
          <thead>
            <tr className="text-xs text-muted-foreground">
              {head.map((h, i) => (
                <th key={h} className={i === 0 ? "py-1 pr-3 font-normal" : "py-1 pl-3 text-right font-normal"}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {r.map((c, j) => (
                  <td key={j} className={j === 0 ? "py-1.5 pr-3" : "money py-1.5 pl-3 text-right"}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function ReportsSection({ s, showValues }: { s: DemoState; showValues: boolean }) {
  const [period, setPeriod] = useState<Period>("6");
  const access = usePlanAccess();
  const navigate = useNavigate();
  const v = useMemo(() => reportsView(s, Number(period)), [s, period]);
  const money = (cents: number) => (showValues ? formatMoney(cents) : HIDDEN);
  const yAxis = (fmt: (n: number) => string) => (
    <YAxis width={showValues ? 52 : 4} tick={showValues ? axis : false} tickLine={false} axisLine={false} tickFormatter={fmt} />
  );

  const flowData = v.flow.map((p) => ({ label: label(p.month), entradas: p.income / 100, saidas: p.expense / 100 }));
  const trendData = v.trend.rows.map((r) => ({ ...Object.fromEntries(v.trend.keys.map((k) => [k, ((r[k] as number) ?? 0) / 100])), label: label(r.month) }));
  const wealthData = v.wealth.map((r) => ({ ...r, label: label(r.month) }));
  const groupColor = (key: string) => SERIES[["previdencia", "investimentos", "reserva", "imovel", "outros"].indexOf(key)]!;
  const t = v.flowTotals;

  return (
    <section className="lg:col-span-12" aria-label="Relatórios">
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">Relatórios</h2>
        <div className="w-56">
          <Segmented
            label="Período dos relatórios"
            value={period}
            onChange={(v) => {
              if (v === "12" && !access.can("relatorios_12m")) {
                toast("Relatórios de 12 meses fazem parte do plano Inteligência.", { action: { label: "Ver planos", onClick: () => void navigate({ to: "/assinatura" }) } });
                return;
              }
              setPeriod(v);
            }}
            options={[...PERIODS]}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <ChartCard title="Fluxo de caixa" className="lg:col-span-7">
          {!v.hasLedger ? (
            <p className="text-sm text-muted-foreground">
              Lance gastos e receitas no{" "}
              <Link to="/diario" className="font-semibold text-primary hover:underline">
                Diário
              </Link>{" "}
              (ou importe o extrato) para ver o que entra e o que sai.
            </p>
          ) : (
            <>
              <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Sobrou no período</dt>
                  <dd className="money font-display text-xl font-bold">{money(t.net)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Taxa de poupança</dt>
                  <dd className="money font-display text-xl font-bold">{t.savingsRate === null ? "—" : formatPercent(t.savingsRate)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Gasto médio por mês</dt>
                  <dd className="money font-display text-xl font-bold">{money(t.averageExpense)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Meses com sobra</dt>
                  <dd className="money font-display text-xl font-bold">
                    {t.monthsWithSurplus} de {t.monthsWithIncome}
                  </dd>
                </div>
              </dl>
              <Legend
                items={[
                  { label: "Entradas", color: SERIES[0]! },
                  { label: "Saídas", color: SERIES[1]! },
                ]}
              />
              <div className="h-56 w-full" aria-hidden>
                <ResponsiveContainer>
                  <BarChart data={flowData} barGap={2} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
                    {yAxis(compact)}
                    {showValues && (
                      <Tooltip
                        cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
                        contentStyle={tooltipStyle}
                        formatter={(val: number, name: string) => [formatMoney(Math.round(val * 100)), name === "entradas" ? "Entradas" : "Saídas"]}
                      />
                    )}
                    <Bar dataKey="entradas" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                    <Bar dataKey="saidas" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                head={["Mês", "Entradas", "Saídas", "Sobra", "Poupança"]}
                rows={v.flow.map((p) => [label(p.month), money(p.income), money(p.expense), money(p.net), p.savingsRate === null ? "—" : formatPercent(p.savingsRate)])}
              />
            </>
          )}
        </ChartCard>

        <ChartCard title="Gastos por categoria" className="lg:col-span-5">
          {v.trend.keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">Os gastos lançados com categoria aparecem aqui, mês a mês.</p>
          ) : (
            <>
              <Legend items={v.trend.keys.map((k, i) => ({ label: v.trend.labels[k]!, color: SERIES[i]! }))} />
              <div className="h-56 w-full" aria-hidden>
                <ResponsiveContainer>
                  <BarChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
                    {yAxis(compact)}
                    {showValues && (
                      <Tooltip
                        cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
                        contentStyle={tooltipStyle}
                        formatter={(val: number, key: string) => [formatMoney(Math.round(val * 100)), v.trend.labels[key] ?? key]}
                      />
                    )}
                    {v.trend.keys.map((k, i) => (
                      <Bar
                        key={k}
                        dataKey={k}
                        stackId="c"
                        fill={SERIES[i]}
                        stroke="var(--card)"
                        strokeWidth={2}
                        maxBarSize={28}
                        radius={i === v.trend.keys.length - 1 ? [4, 4, 0, 0] : 0}
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                head={["Categoria", ...v.months.map(label)]}
                rows={v.trend.keys.map((k) => [v.trend.labels[k], ...v.trend.rows.map((r) => money((r[k] as number) ?? 0))])}
              />
            </>
          )}
        </ChartCard>

        <ChartCard title="Patrimônio por grupo" className="lg:col-span-12">
          {!v.hasWealthHistory || v.wealthGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Atualize os itens do{" "}
              <Link to="/patrimonio" className="font-semibold text-primary hover:underline">
                Patrimônio
              </Link>{" "}
              ao longo dos meses para ver como cada grupo cresce.
            </p>
          ) : (
            <>
              <Legend items={v.wealthGroups.map((g) => ({ label: g.label, color: groupColor(g.key) }))} />
              <div className="h-60 w-full" aria-hidden>
                <ResponsiveContainer>
                  <AreaChart data={wealthData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} />
                    {yAxis(compact)}
                    {showValues && (
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(val: number, key: string) => [formatWealth(val), v.wealthGroups.find((g) => g.key === key)?.label ?? key]}
                      />
                    )}
                    {v.wealthGroups.map((g) => (
                      <Area
                        key={g.key}
                        type="monotone"
                        dataKey={g.key}
                        stackId="w"
                        stroke={groupColor(g.key)}
                        strokeWidth={2}
                        fill={groupColor(g.key)}
                        fillOpacity={0.35}
                        isAnimationActive={false}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">Inclui o que não é para a aposentadoria, como a reserva. Dívidas e rendas futuras ficam de fora.</p>
              <DataTable
                head={["Mês", ...v.wealthGroups.map((g) => g.label)]}
                rows={v.wealth.map((r) => [label(r.month), ...v.wealthGroups.map((g) => (showValues ? formatWealth(r[g.key]) : HIDDEN))])}
              />
            </>
          )}
        </ChartCard>
      </div>
    </section>
  );
}
