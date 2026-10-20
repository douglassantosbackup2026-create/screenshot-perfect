import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, Flame, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { JourneyMap } from "@/components/JourneyMap";
import { SuggestionCard } from "@/components/portfolio/PortfolioSection";
import { handleResult, xpToast } from "@/components/feedback";
import { completedDays, demo, useDemo } from "@/lib/data/demo-store";
import { dataWarnings, journeyHome, missionOfWeek } from "@/lib/data/selectors";
import { XP } from "@/lib/gamification/rules";
import type { DailyKind } from "@/lib/journey/journey";
import { UNITS } from "@/content/journey";

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({
    meta: [
      { title: "Jornada — Previdência Intelligence" },
      { name: "description", content: "Sua trilha de aprendizado, a missão do dia e o seu próximo passo." },
      { property: "og:title", content: "Jornada — Previdência Intelligence" },
      { property: "og:description", content: "Sua trilha de aprendizado, a missão do dia e o seu próximo passo." },
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
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-8 lg:max-w-5xl lg:px-8 lg:pb-12">
      <header>
        <p className="eyebrow">Sua jornada</p>
        <h1 className="mt-1">Olá, {s.profile.displayName || "você"}</h1>
        <p className="mt-1 text-muted-foreground">Pequenos passos, futuro mais preparado.</p>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <div className="space-y-4 lg:sticky lg:top-6">
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

          <DailyMissionCard mission={j.mission} done={j.missionDone} />

          {s.plan && <SuggestionCard s={s} showValues={!s.profile.hideValues} compact />}

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
        </div>

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
      </div>
    </main>
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
