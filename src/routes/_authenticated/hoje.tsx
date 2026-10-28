import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Check, Flame, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CardBoundary } from "@/components/ErrorBoundary";
import { Progress } from "@/components/ui/progress";
import { JourneyMap } from "@/components/JourneyMap";
import { SuggestionCard } from "@/components/portfolio/PortfolioSection";
import { handleResult, xpToast } from "@/components/feedback";
import { completedDays, demo, monthCloseSteps, useDemo, type DemoState } from "@/lib/data/demo-store";
import { maskMoney, monthYear } from "@/lib/labels";
import { formatMonthly, formatPercent } from "@/lib/calc/format";
import { cn } from "@/lib/utils";
import { dataWarnings, firstSteps, journeyHome, missionOfWeek, monthHero, nextStep } from "@/lib/data/selectors";
import { DailyAlertsCard } from "@/components/ledger/DayToDay";
import { XP } from "@/lib/gamification/rules";
import type { DailyKind } from "@/lib/journey/journey";
import { UNITS } from "@/content/journey";
import { JOURNEY_ENABLED } from "@/lib/features";

const TITLE = JOURNEY_ENABLED ? "Jornada — Previdência Intelligence" : "Início — Previdência Intelligence";
const DESCRIPTION = JOURNEY_ENABLED
  ? "Sua trilha de aprendizado, a missão do dia e o seu próximo passo."
  : "O fechamento do mês, a sugestão de aporte e o seu próximo passo.";

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: JourneyPage,
});

function JourneyPage() {
  const s = useDemo();
  const now = new Date();
  const j = journeyHome(s, now);
  const done = completedDays(s);
  const warnings = dataWarnings(s, now);
  const { mission: weekly, done: weeklyDone } = missionOfWeek(s, now);
  const lvl = j.level;
  const toNext = lvl.next != null ? lvl.next - s.stats.totalXp : 0;
  const unitDone = j.unit ? j.unit.lessons.filter((d) => done.includes(d)).length : 0;

  function doWeekly() {
    const r = demo.completeMission(weekly.slug);
    xpToast("Missão da semana concluída.", r.xpAwarded);
    handleResult(r);
  }

  return (
    <main className={`mx-auto w-full max-w-[480px] px-5 pb-32 pt-8 lg:px-8 lg:pb-12 ${JOURNEY_ENABLED ? "lg:max-w-5xl" : "lg:max-w-2xl"}`}>
      <header>
        <p className="eyebrow">{JOURNEY_ENABLED ? "Sua jornada" : "Início"}</p>
        <h1 className="mt-1">Olá, {s.profile.displayName || "você"}</h1>
        <p className="mt-1 text-muted-foreground">Pequenos passos, futuro mais preparado.</p>
      </header>

      <div className={`mt-6 grid gap-4 lg:items-start ${JOURNEY_ENABLED ? "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" : ""}`}>
        <div className={`space-y-4 ${JOURNEY_ENABLED ? "lg:sticky lg:top-6" : ""}`}>
          {JOURNEY_ENABLED && (
          <section className="grid grid-cols-[auto_1fr] gap-4 rounded-3xl bg-card p-5 shadow-card" aria-label="Sequência e nível">
            <div className="flex flex-col items-center justify-center rounded-2xl bg-primary/15 px-4 py-3 text-primary">
              <Flame size={22} strokeWidth={2} aria-hidden />
              <span className="font-display text-3xl font-semibold leading-none">{s.stats.dayStreak}</span>
              <span className="text-xs">{s.stats.dayStreak === 1 ? "dia" : "dias"}</span>
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-semibold">
                <Star size={16} strokeWidth={2} className="text-primary" aria-hidden />
                Nível {lvl.level} · {lvl.name}
              </p>
              {lvl.next != null ? (
                <>
                  <Progress
                    value={((s.stats.totalXp - lvl.min) / (lvl.next - lvl.min)) * 100}
                    className="mt-3 h-2"
                    aria-label={`${s.stats.totalXp} de ${lvl.next} XP`}
                  />
                  <p className="mt-2 text-sm">
                    <span className="money">{s.stats.totalXp}</span> / <span className="money">{lvl.next}</span> XP
                  </p>
                  <p className="text-xs text-muted-foreground">Faltam {toNext} XP para o próximo nível</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  <span className="money">{s.stats.totalXp}</span> XP · último nível alcançado
                </p>
              )}
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              Um dia com atividade mantém a sequência. Até 2 dias por semana ficam protegidos: pausar não zera nada.
            </p>
          </section>
          )}

          {JOURNEY_ENABLED && <DailyMissionCard mission={j.mission} done={j.missionDone} />}

          <CardBoundary><MonthHeroCard s={s} /></CardBoundary>
          <CardBoundary><NextStepCard s={s} /></CardBoundary>
          <FirstStepsCard s={s} />
          <MonthCloseCard s={s} />

          {s.plan && <CardBoundary><SuggestionCard s={s} showValues={!s.profile.hideValues} compact /></CardBoundary>}

          <CardBoundary><DailyAlertsCard s={s} showValues={!s.profile.hideValues} /></CardBoundary>

          {warnings.length > 0 && (
            <section className="rounded-2xl bg-card p-5 shadow-card" aria-label="Dados para completar">
              <h2 className="flex items-center gap-2 text-base">
                <AlertCircle size={18} strokeWidth={1.75} className="text-primary" aria-hidden />
                Para a estimativa ficar mais fiel
              </h2>
              <ul className="mt-3 space-y-1">
                {warnings.map((w) => (
                  <li key={w.key}>
                    <Link to={w.to} className="flex min-h-10 items-center justify-between gap-4 rounded-xl px-2 text-sm hover:bg-muted">
                      {w.message}
                      <span aria-hidden className="text-primary">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {JOURNEY_ENABLED && (
          <section className="rounded-2xl bg-card p-5 shadow-card" aria-label="Missão da semana">
            <p className="eyebrow">Missão da semana · +{XP.weekly_mission} XP</p>
            <h2 className="mt-1 text-lg">{weekly.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{weekly.description}</p>
            {weeklyDone ? (
              <p className="mt-3 text-sm font-semibold text-primary">Feita. A próxima chega na segunda.</p>
            ) : (
              <Button variant="outline" className="mt-4 w-full" onClick={doWeekly}>
                Marquei como feita
              </Button>
            )}
          </section>
          )}
        </div>

        {JOURNEY_ENABLED && (
        <section aria-label="Trilha">
          <div className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-[0_20px_48px_-20px_rgb(246_200_0/0.55)]">
            <p className="eyebrow !text-primary-foreground/70">Sua trilha de hoje</p>
            {j.unit ? (
              <>
                <h2 className="mt-1 text-2xl leading-tight">
                  Unidade {j.unit.n} · {j.unit.title}
                </h2>
                <p className="mt-2 text-sm text-primary-foreground/75">
                  {unitDone} de {j.unit.lessons.length} lições · ao concluir: {j.unit.result.toLowerCase()}
                </p>
                <Button asChild variant="dark" className="mt-5 w-full">
                  <Link to="/programa/$dia" params={{ dia: String(j.current!.day) }}>
                    Continuar: lição {j.current!.indexInUnit} de {j.current!.unitSize}
                  </Link>
                </Button>
              </>
            ) : (
              <>
                <h2 className="mt-1 text-2xl leading-tight">Jornada concluída</h2>
                <p className="mt-2 text-sm text-primary-foreground/75">
                  Você passou pelas {UNITS.length} unidades. Agora o foco é revisar o plano e manter a constância.
                </p>
              </>
            )}
          </div>
          <div className="mt-8">
            <JourneyMap nodes={j.nodes} completed={done} testedOut={s.journey.testedOutUnits} />
          </div>
        </section>
        )}
      </div>
    </main>
  );
}

/** O número que importa: quanto o plano pede neste mês, quanto já foi registrado e o caminho até a independência. */
function MonthHeroCard({ s }: { s: DemoState }) {
  const h = monthHero(s);
  if (!h) return null;
  const money = maskMoney(!s.profile.hideValues, formatMonthly);
  const status =
    h.contributed === null
      ? "Você ainda não registrou o aporte deste mês."
      : h.contributed >= h.required
        ? "Você está no ritmo do plano neste mês."
        : h.contributed > 0
          ? `Você registrou ${money(h.contributed)}.`
          : "Mês registrado sem aporte. Tudo bem: o plano segue.";
  return (
    <section className="rounded-3xl bg-primary p-6 text-primary-foreground shadow-[0_20px_48px_-20px_rgb(246_200_0/0.55)]" aria-label="Seu mês">
      <p className="eyebrow !text-primary-foreground/70">{monthYear(h.month)}</p>
      <p className="mt-1 text-lg leading-7">
        Seu plano pede guardar <strong className="money block font-display text-4xl font-semibold">{money(h.required)}</strong> por mês.
      </p>
      <p className="mt-2 text-sm text-primary-foreground/80">{status}</p>
      <div className="mt-5">
        <div className="flex justify-between text-xs font-semibold text-primary-foreground/70">
          <span>Rumo à independência</span>
          <span className="money">{formatPercent(h.fiRatio)}</span>
        </div>
        <Progress value={Math.min(h.fiRatio, 1) * 100} className="mt-1.5 h-2 bg-black/15 [&>div]:bg-primary-foreground" aria-label={`${formatPercent(h.fiRatio)} do caminho até a independência`} />
      </div>
    </section>
  );
}

/** Um único próximo passo: o que mais move o plano agora. */
function NextStepCard({ s }: { s: DemoState }) {
  const n = nextStep(s);
  if (!n)
    return (
      <section className="rounded-2xl bg-card p-5 shadow-card" aria-label="Próximo passo">
        <p className="eyebrow">Próximo passo</p>
        <h2 className="mt-1 text-lg">Tudo em dia por aqui</h2>
        <p className="mt-1 text-sm text-muted-foreground">Veja como o seu patrimônio evoluiu.</p>
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link to="/evolucao">Ver meu progresso</Link>
        </Button>
      </section>
    );
  return (
    <section className="rounded-2xl bg-card p-5 shadow-card ring-1 ring-primary/60" aria-label="Próximo passo">
      <p className="eyebrow">Próximo passo</p>
      <h2 className="mt-1 text-lg">{n.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{n.why}</p>
      <Button asChild className="mt-4 w-full">
        <Link to={n.to} search={n.search ?? {}}>
          {n.cta}
        </Link>
      </Button>
    </section>
  );
}

/** Para quem está começando: os três primeiros passos, riscados conforme são feitos. */
function FirstStepsCard({ s }: { s: DemoState }) {
  const items = firstSteps(s);
  if (!items) return null;
  const done = items.filter((i) => i.done).length;
  return (
    <section className="rounded-2xl bg-card p-5 shadow-card" aria-label="Primeiros passos">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base">Primeiros passos</h2>
        <span className="text-sm text-muted-foreground">
          {done} de {items.length}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((i) => (
          <li key={i.key} className={cn("flex items-center gap-3 text-sm", i.done && "text-muted-foreground line-through")}>
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", i.done ? "bg-primary text-primary-foreground" : "bg-muted")} aria-hidden>
              {i.done && <Check size={14} strokeWidth={3} />}
            </span>
            {i.label}
            <span className="sr-only">{i.done ? "(feito)" : "(a fazer)"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** O ritual do mês: quantos passos já foram feitos e o atalho para o fechamento. */
function MonthCloseCard({ s }: { s: DemoState }) {
  const c = monthCloseSteps(s);
  return (
    <section className="rounded-2xl bg-card p-5 shadow-card" aria-label="Fechamento do mês">
      <p className="eyebrow">Fechamento do mês{JOURNEY_ENABLED ? ` · +${XP.month_closed} XP` : ""}</p>
      <h2 className="mt-1 text-lg">{c.closed ? `${monthYear(c.month)} fechado` : `Seu mês: ${c.doneCount} de ${c.steps.length}`}</h2>
      <Progress value={(c.doneCount / c.steps.length) * 100} className="mt-3 h-2" aria-label={`${c.doneCount} de ${c.steps.length} passos`} />
      <p className="mt-2 text-sm text-muted-foreground">
        {c.closed
          ? "Tudo em dia. O próximo fechamento abre no mês que vem."
          : c.complete
            ? "Todos os passos estão feitos. Falta só fechar."
            : c.usesLedger
              ? "Lançar, categorizar, orçar, aportar e atualizar o patrimônio: uns 10 minutos."
              : "Registrar o aporte e atualizar o patrimônio: uns 2 minutos."}
      </p>
      {!c.closed && (
        <Button asChild variant={c.complete ? "default" : "outline"} className="mt-4 w-full">
          <Link to="/fechamento">{c.complete ? "Fechar o mês" : c.doneCount ? "Continuar o fechamento" : "Começar o fechamento"}</Link>
        </Button>
      )}
    </section>
  );
}

function DailyMissionCard({ mission, done }: { mission: ReturnType<typeof journeyHome>["mission"]; done: boolean }) {
  const xp = XP.daily_mission + (mission.lessonDay != null ? XP.lesson_completed : 0);

  function confirm(kind: DailyKind) {
    try {
      const r = demo.completeDailyMission(kind);
      xpToast("Missão do dia concluída.", r.xpAwarded);
      handleResult(r);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <section className="rounded-2xl bg-card p-5 shadow-card ring-1 ring-primary/40" aria-label="Missão do dia">
      <p className="eyebrow">Missão do dia</p>
      <h2 className="mt-1 text-lg">{mission.title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{mission.description}</p>
      <p className="mt-3 text-xs text-muted-foreground">
        {mission.minutes} minutos · +{xp} XP{mission.kind === "rest" ? " · opcional" : ""}
      </p>
      {done ? (
        <p className="mt-3 text-sm font-semibold text-primary">Missão de hoje feita. Amanhã tem outra.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          {mission.lessonDay != null && (
            <Button asChild>
              <Link to="/programa/$dia" params={{ dia: String(mission.lessonDay) }}>
                Começar
              </Link>
            </Button>
          )}
          {(mission.kind === "quiz" || mission.kind === "review") && (
            <Button asChild>
              <Link to="/revisao">Começar</Link>
            </Button>
          )}
          {(mission.kind === "goal" || mission.kind === "scenario") && (
            <>
              <Button asChild>
                <Link to={mission.kind === "goal" ? "/evolucao" : "/plano"}>{mission.kind === "goal" ? "Ver minhas metas" : "Abrir o simulador"}</Link>
              </Button>
              <Button variant="outline" onClick={() => confirm(mission.kind)}>
                Marquei como feita
              </Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
