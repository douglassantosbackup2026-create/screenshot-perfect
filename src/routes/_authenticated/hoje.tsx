import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ThreadStrip } from "@/components/ConstancyThread";
import { handleResult, xpToast } from "@/components/feedback";
import { demo, lessonStatus, useDemo } from "@/lib/data/demo-store";
import { hasMonthRecord, missionOfWeek, planSummary } from "@/lib/data/selectors";
import { lastMonths } from "@/lib/data/thread";
import { formatMonthly } from "@/lib/calc/format";
import { monthName } from "@/lib/labels";
import { monthOf, spDate } from "@/lib/gamification/rules";
import { LESSONS, PROGRAM } from "@/content/program";
import { LEVELS } from "@/lib/gamification/rules";

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({
    meta: [
      { title: "Hoje — Previdência Intelligence" },
      { name: "description", content: "Sua lição do dia, a missão da semana e o seu fio da constância." },
      { property: "og:title", content: "Hoje — Previdência Intelligence" },
      { property: "og:description", content: "Sua lição do dia, a missão da semana e o seu fio da constância." },
    ],
  }),
  component: Today,
});

function Today() {
  const s = useDemo();
  const now = new Date();
  const ls = lessonStatus(s, now);
  const lesson = LESSONS.find((l) => l.day === ls.day)!;
  const { mission, done: missionDone } = missionOfWeek(s, now);
  const today = spDate(now);
  const month = monthOf(today);
  const needsLog = !hasMonthRecord(s, now) && Number(today.slice(8, 10)) >= s.profile.reminderDay;
  const plan = planSummary(s);
  const level = LEVELS.find((l) => l.level === s.stats.level)!;
  const minutes = Math.min(5, 3 + Math.round(lesson.keyPoints.length / 3));

  function doMission() {
    const r = demo.completeMission(mission.slug);
    xpToast("Missão da semana concluída.", r.xpAwarded);
    handleResult(r);
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-28 pt-8">
      <header>
        <h1>Olá, {s.profile.displayName || "você"}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-border px-3 py-1">
            {s.stats.weekStreak === 1 ? "1 semana seguida" : `${s.stats.weekStreak} semanas seguidas`}
          </span>
          <span className="text-muted-foreground">
            Nível {level.level} · {level.name} · <span className="money">{s.stats.totalXp}</span> XP
          </span>
        </div>
      </header>

      <section className="mt-8 rounded-2xl border border-primary/30 bg-card p-6">
        {!ls.finished ? (
          ls.doneToday ? (
            <>
              <p className="text-sm text-muted-foreground">
                Dia {Math.min(ls.day - 1, PROGRAM.totalDays) || 1} de {PROGRAM.totalDays}
              </p>
              <p className="mt-2 font-display text-xl font-semibold">Lição de hoje concluída. A próxima abre amanhã.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Dia {ls.day} de {PROGRAM.totalDays} · {minutes} min
              </p>
              <h2 className="mt-2">{lesson.title}</h2>
              <Button asChild className="mt-5 w-full">
                <Link to="/programa/$dia" params={{ dia: String(ls.day) }}>
                  Começar dia {ls.day}
                </Link>
              </Button>
            </>
          )
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Missão da semana</p>
            <h2 className="mt-2">{mission.title}</h2>
            <p className="mt-2 text-muted-foreground">{mission.description}</p>
            {missionDone ? (
              <p className="mt-5 font-semibold">Missão feita. A próxima chega na segunda.</p>
            ) : (
              <Button className="mt-5 w-full" onClick={doMission}>
                Fazer a missão
              </Button>
            )}
          </>
        )}
      </section>

      {needsLog && (
        <Link
          to="/diario"
          search={{ registrar: true }}
          className="mt-4 flex min-h-12 items-center justify-between rounded-2xl border border-border bg-card px-5 font-semibold"
        >
          Registrar aporte de {monthName(month)}
          <span aria-hidden>→</span>
        </Link>
      )}

      <section className="mt-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg">Seu fio</h2>
          <span className="text-xs text-muted-foreground">últimos 6 meses</span>
        </div>
        <Link to="/diario" className="mt-4 block rounded-2xl p-2 hover:bg-muted" aria-label="Abrir o Diário">
          <ThreadStrip months={lastMonths(s.contributions, 6, now)} />
        </Link>
      </section>

      {plan && (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="text-lg">Seu plano</h2>
          <p className="mt-2">
            {plan.current >= plan.required ? (
              "No cenário central, seu aporte atual cobre o objetivo."
            ) : (
              <>
                No cenário central, sem INSS, faltam cerca de{" "}
                <strong className="money">{formatMonthly(plan.required - plan.current)}</strong> por mês para o seu objetivo.
              </>
            )}
          </p>
          <Link to="/plano" className="mt-3 inline-block min-h-11 py-2.5 text-sm font-semibold text-primary">
            Ver plano
          </Link>
        </section>
      )}
    </main>
  );
}
