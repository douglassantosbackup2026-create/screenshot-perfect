import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { BookOpen, Check, Landmark, Mountain, Star, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, GRID, TOOLTIP_STYLE } from "@/components/chart-theme";
import { Button } from "@/components/ui/button";
import { HideValuesToggle } from "@/components/HideValuesToggle";
import { ShowValuesProvider, useShowValues } from "@/hooks/use-show-values";
import { CardBoundary } from "@/components/ErrorBoundary";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BottomSheetContent } from "@/components/BottomSheet";
import { NumberField, Segmented } from "@/components/forms";
import { handleResult, xpToast } from "@/components/feedback";
import { ActivityList, ChartCard, ContributionsChart, DeltaChip, DestinationDonut, Gauge, GoalCard, StatCard } from "@/components/dashboard";
import { HIDDEN, dayLabel } from "@/lib/labels";
import { ThreadStrip } from "@/components/ConstancyThread";
import { WealthSheet } from "@/components/wealth/WealthSheet";
import { ReportsSection } from "@/components/reports/ReportsSection";
import { ProjectedVsReal } from "@/components/plan/Tracking";
import { activeChallenges, completedDays, demo, MAX_ACTIVE_CHALLENGES, useDemo, type DemoState, type GoalKind } from "@/lib/data/demo-store";
import { activeGoals, currentWealth, milestones, planSummary, recentActivity, wealthGrowth } from "@/lib/data/selectors";
import { lastMonths } from "@/lib/data/thread";
import { contributionsByDestination, fiProgress, monthlyContributionSeries, projectMonthlyPath, selfComparison, wealthTimeline } from "@/lib/calc/progress";
import { formatMonthly, formatPercent, formatWealth } from "@/lib/calc/format";
import { levelFromXp } from "@/lib/gamification/rules";
import { unitProgress } from "@/lib/journey/journey";
import { UNITS } from "@/content/journey";
import { cn } from "@/lib/utils";
import { JOURNEY_ENABLED } from "@/lib/features";
import { monthShort, monthYear } from "@/lib/labels";
import { addMonths, monthOf, spDate } from "@/lib/gamification/rules";
import { CHALLENGES } from "@/content/challenges";
import { errMsg } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/evolucao")({
  validateSearch: (s: Record<string, unknown>): { registrar?: boolean; meta?: boolean } => ({
    ...(s["registrar"] ? { registrar: true } : {}),
    ...(s["meta"] ? { meta: true } : {}),
  }),
  head: () => pageHead("Progresso", "Sua evolução patrimonial, metas e desafios, comparados só com você mesmo."),
  component: Evolution,
});

const PERIODS = [
  { value: "3", label: "3 meses" },
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
] as const;
type Period = (typeof PERIODS)[number]["value"];

const signed = (v: number, fmt: (n: number) => string) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt(Math.abs(v));

function Evolution() {
  const s = useDemo();
  const { registrar, meta } = Route.useSearch();
  const navigate = useNavigate();
  const current = monthOf(spDate(new Date()));
  const { showValues, toggle: toggleValues } = useShowValues();
  const [period, setPeriod] = useState<Period>("6");
  const [wealthMonth, setWealthMonth] = useState<string | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [months, setMonths] = useState<6 | 12>(6);

  useEffect(() => {
    // O registro do patrimônio mora no Patrimônio; links antigos para cá seguem para lá.
    if (registrar) navigate({ to: "/patrimonio", search: { registrar: true }, replace: true });
    else if (meta) {
      setGoalOpen(true);
      navigate({ to: "/evolucao", search: {}, replace: true });
    }
  }, [registrar, meta, navigate]);

  const money = (v: number) => (showValues ? formatWealth(v) : HIDDEN);
  const wealth = currentWealth(s);
  const fi = s.plan ? fiProgress(s.plan.inputs, wealth) : null;
  const marks = milestones(s);
  const cmp = selfComparison(s.wealthEntries, Number(period));
  const loggedThisMonth = s.wealthEntries.some((w) => w.month === current);
  const plan = planSummary(s);
  const thisMonth = s.contributions.find((c) => c.month === current);
  const cmp6 = selfComparison(s.wealthEntries, 6);
  const lvl = levelFromXp(s.stats.totalXp);
  const done = completedDays(s);
  const unitsDone = UNITS.filter((u) => unitProgress(u, done).complete).length;

  return (
    <ShowValuesProvider value={showValues}>
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-8 lg:max-w-6xl lg:px-8 lg:pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Progresso</h1>
          <p className="mt-1 text-sm text-muted-foreground">Você comparado com você mesmo. Ninguém mais vê estes números.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <HideValuesToggle showValues={showValues} onToggle={toggleValues} />
          <Button asChild variant={loggedThisMonth ? "outline" : "default"}>
            <Link to="/patrimonio" search={loggedThisMonth ? {} : { registrar: true }}>
              {loggedThisMonth ? "Ver patrimônio" : "Registrar patrimônio"}
            </Link>
          </Button>
        </div>
      </header>

      <div
        className={cn(
          "-mx-5 mt-6 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0",
          JOURNEY_ENABLED ? "lg:grid-cols-4" : "lg:grid-cols-2",
        )}
        aria-label="Seus números"
      >
        <StatCard
          className="w-[72%] shrink-0 snap-start lg:w-auto"
          label="Patrimônio"
          icon={Landmark}
          to="/patrimonio"
          value={money(wealth)}
          footer={cmp6?.ratioChange != null ? <DeltaChip value={cmp6.ratioChange} suffix="em 6 meses" /> : "Registre todo mês para comparar"}
        />
        <StatCard
          className="w-[72%] shrink-0 snap-start lg:w-auto"
          label="Aporte do mês"
          icon={Wallet}
          to="/diario"
          value={thisMonth?.made ? (thisMonth.amount != null ? (showValues ? formatMonthly(thisMonth.amount) : HIDDEN) : "Feito") : thisMonth ? "Registrado" : "—"}
          footer={plan ? `Plano pede ${showValues ? formatMonthly(plan.required) : HIDDEN}` : "Crie seu plano para ter uma meta"}
        />
        {JOURNEY_ENABLED && (
        <>
        <StatCard
          className="w-[72%] shrink-0 snap-start lg:w-auto"
          label="Aprendizado"
          icon={BookOpen}
          to="/hoje"
          value={`${done.length} de 21`}
          footer={`lições · ${unitsDone} de ${UNITS.length} unidades`}
        />
        <StatCard
          className="w-[72%] shrink-0 snap-start lg:w-auto"
          label="Experiência"
          icon={Star}
          to="/perfil"
          value={`${s.stats.totalXp} XP`}
          footer={`Nível ${lvl.level} · ${lvl.name} · ${s.stats.dayStreak} ${s.stats.dayStreak === 1 ? "dia" : "dias"} seguidos`}
        />
        </>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        <section
          className="flex flex-col rounded-3xl bg-primary p-6 text-primary-foreground shadow-[0_20px_48px_-20px_rgb(246_200_0/0.55)] lg:col-span-5"
          aria-label="Rumo à independência"
        >
          <p className="eyebrow !text-primary-foreground/70">Rumo à independência</p>
          {fi ? (
            <>
              <div className="relative mx-auto mt-4 w-full max-w-[300px]">
                <Gauge ratio={fi.ratio} />
                <div className="absolute inset-x-0 bottom-0 text-center">
                  <p className="money font-display text-5xl font-bold leading-none">{formatPercent(fi.ratio)}</p>
                  <p className="mt-1 text-xs font-semibold text-primary-foreground/70">do patrimônio-alvo</p>
                </div>
              </div>
              <p className="mt-6 text-sm text-primary-foreground/80">
                <span className="money font-semibold text-primary-foreground">{money(wealth)}</span> de cerca de{" "}
                <span className="money font-semibold text-primary-foreground">{money(fi.targetWealth)}</span> para viver de renda no cenário
                central, sem INSS.
              </p>
              {marks && (
                <ol className="mt-4 flex gap-2" aria-label="Marcos">
                  {marks.milestones.map((m) => (
                    <li
                      key={m.ratio}
                      className={cn(
                        "money flex min-h-8 flex-1 items-center justify-center gap-1 rounded-full text-xs font-semibold",
                        m.reached ? "bg-primary-foreground text-primary" : "bg-black/10 text-primary-foreground/70",
                        m.ratio === marks.next && "ring-2 ring-primary-foreground/60",
                      )}
                    >
                      {m.reached && <Check size={12} strokeWidth={3} aria-hidden />}
                      {Math.round(m.ratio * 100)}%
                      <span className="sr-only">{m.reached ? "alcançado" : m.ratio === marks.next ? "próximo marco" : "a alcançar"}</span>
                    </li>
                  ))}
                </ol>
              )}
              <dl className="mt-auto grid grid-cols-2 gap-3 pt-6">
                <div className="rounded-2xl bg-black/10 p-3">
                  <dt className="text-xs text-primary-foreground/70">Hoje</dt>
                  <dd className="money font-display text-2xl font-bold">{formatPercent(fi.ratio)}</dd>
                </div>
                <div className="rounded-2xl bg-black/10 p-3">
                  <dt className="text-xs text-primary-foreground/70">Na aposentadoria, no ritmo atual</dt>
                  <dd className="money font-display text-2xl font-bold">{formatPercent(fi.projectedRatioAtRetirement)}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p className="mt-2">
              Crie seu plano para ver quanto do caminho você já fez.{" "}
              <Link to="/plano" className="font-semibold underline">
                Criar plano
              </Link>
            </p>
          )}
        </section>

        <ChartCard title="Linha do tempo" className="lg:col-span-7">
          {cmp && (
            <div className="mb-4">
              <Segmented label="Comparar com" value={period} onChange={setPeriod} options={[...PERIODS]} />
              <p className="mt-3 text-sm">
                Desde {monthYear(cmp.fromMonth).toLowerCase()}:{" "}
                <strong className="money">{showValues ? signed(cmp.delta, formatWealth) : cmp.delta >= 0 ? "cresceu" : "diminuiu"}</strong>
                {cmp.ratioChange !== null && <span className="money text-primary"> ({signed(cmp.ratioChange, formatPercent)})</span>}
              </p>
            </div>
          )}
          <TimelineChart s={s} showValues={showValues} />
        </ChartCard>
      </div>

      <Tabs defaultValue="evolucao" className="mt-8">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="evolucao" className="flex-1">Evolução</TabsTrigger>
          <TabsTrigger value="metas" className="flex-1">Metas</TabsTrigger>
          <TabsTrigger value="historico" className="flex-1">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="evolucao" className="mt-4 grid gap-4 lg:grid-cols-12">
        <CardBoundary><ProjectedVsReal s={s} showValues={showValues} /></CardBoundary>

        <CardBoundary><GrowthCard s={s} showValues={showValues} /></CardBoundary>

        <ChartCard
          title="Aportes x meta"
          className="lg:col-span-8"
          action={
            <div className="flex rounded-full bg-muted p-1 text-xs" role="radiogroup" aria-label="Período">
              {([6, 12] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={months === m}
                  onClick={() => setMonths(m)}
                  className={cn("min-h-11 rounded-full px-3", months === m ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground")}
                >
                  {m} meses
                </button>
              ))}
            </div>
          }
        >
          <ContributionsChart series={monthlyContributionSeries(s.contributions, current, months)} target={plan?.required ?? null} showValues={showValues} />
        </ChartCard>

        <ChartCard title="Para onde vão seus aportes" className="lg:col-span-4">
          <DestinationDonut data={contributionsByDestination(s.contributions)} showValues={showValues} />
        </ChartCard>

        <ChartCard title="Seu fio" className="lg:col-span-12" action={<span className="text-xs text-muted-foreground">últimos 6 meses</span>}>
          <Link to="/diario" className="block rounded-2xl p-2 hover:bg-muted" aria-label="Abrir Lançamentos">
            <ThreadStrip months={lastMonths(s.contributions, 6, new Date())} />
          </Link>
        </ChartCard>
        </TabsContent>

        <TabsContent value="metas" className="mt-4 grid gap-4 lg:grid-cols-12">
        <Goals s={s} wealth={wealth} showValues={showValues} onNew={() => setGoalOpen(true)} />
        <Challenges s={s} />
        </TabsContent>

        <TabsContent value="historico" className="mt-4 grid gap-4 lg:grid-cols-12">
        <ChartCard title="Histórico" className="lg:col-span-6">
          <ActivityList
            items={recentActivity(s, 15)}
            showValues={showValues}
            empty="Seus registros aparecem aqui."
            action={(item) =>
              item.kind === "patrimonio" ? (
                <Button size="sm" variant="ghost" onClick={() => setWealthMonth(item.month)}>
                  Editar
                </Button>
              ) : null
            }
          />
        </ChartCard>

        <CardBoundary><ReportsSection s={s} showValues={showValues} /></CardBoundary>
        </TabsContent>
      </Tabs>

      <WealthSheet s={s} month={wealthMonth} onClose={() => setWealthMonth(null)} />
      <GoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} />
    </main>
    </ShowValuesProvider>
  );
}

function TimelineChart({ s, showValues }: { s: DemoState; showValues: boolean }) {
  const tl = wealthTimeline(s.wealthEntries);
  if (tl.length === 0) {
    return <p className="text-sm text-muted-foreground">Registre seu patrimônio uma vez por mês. Com dois registros, a linha do tempo aparece aqui.</p>;
  }
  const last = tl[tl.length - 1]!;
  const path = s.plan ? projectMonthlyPath(s.plan.inputs, last.total, 12) : [];
  const data: { label: string; real?: number; projecao?: number }[] = tl.map((p) => ({
    label: `${monthShort(p.month)}/${p.month.slice(2, 4)}`,
    real: p.total,
  }));
  if (path.length) {
    data[data.length - 1]!.projecao = path[0]!;
    for (let k = 3; k < path.length; k += 3) {
      const m = addMonths(last.month, k);
      data.push({ label: `${monthShort(m)}/${m.slice(2, 4)}`, projecao: path[k]! });
    }
  }
  return (
    <figure>
      <div className="h-56 w-full" aria-hidden>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis
              width={showValues ? 48 : 8}
              tick={showValues ? AXIS_TICK : false}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} mi` : `${Math.round(v / 1e3)} mil`)}
            />
            {showValues && (
              <Tooltip
                formatter={(v: number, name: string) => [formatWealth(v), name === "real" ? "Registrado" : "Projeção"]}
                contentStyle={TOOLTIP_STYLE}
              />
            )}
            <Area type="monotone" dataKey="real" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.15} strokeWidth={2.5} isAnimationActive={false} connectNulls={false} />
            <Line type="monotone" dataKey="projecao" stroke="var(--primary)" strokeOpacity={0.6} strokeDasharray="6 6" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-sm text-muted-foreground">
        Linha cheia: o que você registrou. {path.length ? "Tracejado: os próximos 12 meses no cenário central, com o aporte do plano." : ""}
      </figcaption>
    </figure>
  );
}

function GrowthCard({ s, showValues }: { s: DemoState; showValues: boolean }) {
  const g = wealthGrowth(s);
  const money = (v: number) => (showValues ? signed(v, formatMonthly) : HIDDEN);
  if (!g.summary) {
    return (
      <ChartCard title="De onde veio o crescimento" className="lg:col-span-12">
        <p className="text-sm text-muted-foreground">Com dois registros de patrimônio, aparece aqui quanto veio dos seus aportes e quanto veio do resto.</p>
      </ChartCard>
    );
  }
  const data = g.timeline.slice(1).map((p) => ({
    label: `${monthShort(p.month)}/${p.month.slice(2, 4)}`,
    aportes: p.contributionsInPeriod,
    outros: p.otherChange ?? 0,
  }));
  return (
    <ChartCard
      title="De onde veio o crescimento"
      className="lg:col-span-12"
      action={<span className="text-xs text-muted-foreground">desde {monthYear(g.summary.fromMonth).toLowerCase()}</span>}
    >
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-muted p-3">
          <dt className="text-xs text-muted-foreground">Crescimento</dt>
          <dd className="money font-display text-2xl font-bold">{money(g.summary.growth)}</dd>
        </div>
        <div className="rounded-2xl bg-muted p-3">
          <dt className="text-xs text-muted-foreground">Dos seus aportes</dt>
          <dd className="money font-display text-2xl font-bold text-primary">{money(g.summary.contributions)}</dd>
        </div>
        <div className="rounded-2xl bg-muted p-3">
          <dt className="text-xs text-muted-foreground">Rendimento e ajustes</dt>
          <dd className="money font-display text-2xl font-bold">{money(g.summary.other)}</dd>
        </div>
        <div className="rounded-2xl bg-muted p-3">
          <dt className="text-xs text-muted-foreground">Rendimento estimado no período</dt>
          <dd className="money font-display text-2xl font-bold">{g.cumulativeReturn === null ? "—" : signed(g.cumulativeReturn, formatPercent)}</dd>
        </div>
      </dl>
      <figure className="mt-4">
        <div className="h-48 w-full" aria-hidden>
          <ResponsiveContainer>
            <BarChart data={data} stackOffset="sign" margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <YAxis
                width={showValues ? 48 : 4}
                tick={showValues ? AXIS_TICK : false}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)} mil` : String(Math.round(v)))}
              />
              <ReferenceLine y={0} stroke="var(--border)" />
              {showValues && (
                <Tooltip
                  cursor={{ fill: "rgb(255 255 255 / 0.04)" }}
                  formatter={(v: number, name: string) => [signed(v, formatMonthly), name === "aportes" ? "Aportes" : "Rendimento e ajustes"]}
                  contentStyle={TOOLTIP_STYLE}
                />
              )}
              <Bar dataKey="aportes" stackId="v" fill="var(--primary)" maxBarSize={36} isAnimationActive={false} />
              <Bar dataKey="outros" stackId="v" fill="var(--chart-2)" maxBarSize={36} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <figcaption className="mt-2 text-sm text-muted-foreground">
          Amarelo: aportes registrados. Cinza: o restante da variação (rendimento, saques e atualização dos valores). A estimativa só fica
          fiel se todos os aportes estiverem registrados.
        </figcaption>
      </figure>
    </ChartCard>
  );
}

function Goals({ s, wealth, showValues, onNew }: { s: DemoState; wealth: number; showValues: boolean; onNew: () => void }) {
  const goals = activeGoals(s);
  const doneCount = s.goals.length - goals.length;
  function complete(id: string) {
    const r = demo.completeGoal(id);
    xpToast("Meta concluída.", r.xpAwarded);
    handleResult(r);
  }
  return (
    <section className="lg:col-span-12" aria-label="Metas">
      <div className="mt-4 flex items-center justify-between gap-3">
        <h2 className="text-lg">
          Metas
          {doneCount > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{doneCount === 1 ? "1 concluída" : `${doneCount} concluídas`}</span>}
        </h2>
        <Button size="sm" variant="outline" onClick={onNew}>
          Nova meta
        </Button>
      </div>
      {goals.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Uma meta clara ajuda a manter o rumo. Pode ser um valor ou um hábito.</p>}
      <ul className="mt-4 grid gap-4 lg:grid-cols-2">
        {goals.map((g) => (
          <GoalCard key={g.id} goal={g} wealth={wealth} showValues={showValues} onComplete={() => complete(g.id)} onDelete={() => demo.deleteGoal(g.id)} />
        ))}
      </ul>
    </section>
  );
}

function Challenges({ s }: { s: DemoState }) {
  const running = activeChallenges(s);
  const runningSlugs = new Set(running.map((c) => c.def.slug));
  const available = CHALLENGES.filter((c) => !runningSlugs.has(c.slug));
  const completed = s.challenges.filter((c) => c.completedAt).length;
  const full = running.length >= MAX_ACTIVE_CHALLENGES;

  function start(slug: string) {
    try {
      handleResult(demo.startChallenge(slug));
      toast("Desafio começou. Bom ritmo!");
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <ChartCard
      title="Desafios pessoais"
      className="lg:col-span-6"
      action={completed > 0 ? <span className="text-xs text-muted-foreground">{completed === 1 ? "1 concluído" : `${completed} concluídos`}</span> : undefined}
    >
      <ul className="space-y-3">
        {running.map(({ def, progress }) => (
          <li key={def.slug} className="rounded-2xl bg-muted p-4 ring-1 ring-primary/40">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Mountain size={18} strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{def.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{def.description}</p>
              </div>
            </div>
            <Progress value={(progress.done / progress.target) * 100} className="mt-4" aria-label={`Progresso do desafio ${def.title}`} />
            <div className="mt-2 flex items-center justify-between text-sm">
              <span>
                <span className="font-semibold text-primary">{progress.done}</span> de {progress.target} · até {dayLabel(progress.endsOn)}
              </span>
              <Button size="sm" variant="ghost" onClick={() => demo.abandonChallenge(def.slug)}>
                Desistir
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {available.length > 0 && (
        <>
          <p className="eyebrow mt-6">Para começar</p>
          {full && <p className="mt-1 text-sm text-muted-foreground">Até {MAX_ACTIVE_CHALLENGES} desafios ao mesmo tempo.</p>}
          <ul className="mt-2 divide-y divide-border">
            {available.map((c) => (
              <li key={c.slug} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-sm text-muted-foreground">{c.description}</p>
                </div>
                <Button size="sm" variant="outline" disabled={full} onClick={() => start(c.slug)}>
                  Começar
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </ChartCard>
  );
}

function GoalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<GoalKind>("valor");
  const [target, setTarget] = useState<number | null>(null);
  const [deadline, setDeadline] = useState("");
  useEffect(() => {
    if (open) {
      setTitle("");
      setKind("valor");
      setTarget(null);
      setDeadline("");
    }
  }, [open]);
  if (!open) return null;

  function save() {
    try {
      const r = demo.createGoal({ title, kind, target, deadline: deadline ? `${deadline}-01` : null });
      xpToast("Meta criada.", r.xpAwarded);
      handleResult(r);
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <BottomSheetContent>
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">Nova meta</SheetTitle>
          <SheetDescription>Metas são suas. Não há meta certa nem errada.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4 pb-4">
          <Segmented
            label="Tipo de meta"
            value={kind}
            onChange={setKind}
            options={[
              { value: "valor", label: "Chegar a um valor" },
              { value: "habito", label: "Criar um hábito" },
            ]}
          />
          <div>
            <label htmlFor="goal-title" className="text-sm font-semibold">
              Nome da meta
            </label>
            <Input
              id="goal-title"
              className="mt-1.5"
              maxLength={80}
              value={title}
              placeholder={kind === "valor" ? "Ex.: reserva para a aposentadoria" : "Ex.: revisar o orçamento todo mês"}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          {kind === "valor" && <NumberField label="Valor da meta" value={target} onChange={setTarget} prefix="R$" />}
          <div>
            <label htmlFor="goal-deadline" className="text-sm font-semibold">
              Prazo <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Input id="goal-deadline" type="month" className="mt-1.5" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <Button className="w-full" onClick={save}>
            Criar meta
          </Button>
        </div>
      </BottomSheetContent>
    </Sheet>
  );
}
