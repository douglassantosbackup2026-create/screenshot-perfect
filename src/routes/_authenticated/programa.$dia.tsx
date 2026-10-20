import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Check, Flag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NumberField, LegalNote } from "@/components/forms";
import { handleResult } from "@/components/feedback";
import { LessonWidget } from "@/components/LessonWidget";
import { completedDays, demo, useDemo } from "@/lib/data/demo-store";
import { LESSONS, type Lesson } from "@/content/program";
import { LESSON_WIDGETS, UNITS } from "@/content/journey";
import { isLessonUnlocked, journeyNodes, nextLesson } from "@/lib/journey/journey";
import { XP } from "@/lib/gamification/rules";
import { lessonFooter } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/programa/$dia")({
  loader: ({ params }) => {
    const lesson = LESSONS.find((l) => String(l.day) === params.dia);
    if (!lesson) throw notFound();
    return { lesson };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.lesson.title} — Previdência Intelligence` : "Lição — Previdência Intelligence" },
      { name: "description", content: loaderData?.lesson.objective ?? "Lição curta da jornada." },
      { property: "og:title", content: loaderData ? loaderData.lesson.title : "Lição" },
      { property: "og:description", content: loaderData?.lesson.objective ?? "Lição curta da jornada." },
    ],
  }),
  component: LessonPage,
});

function LessonPage() {
  const { lesson } = Route.useLoaderData();
  const s = useDemo();
  const navigate = useNavigate();
  const [celebrate, setCelebrate] = useState(false);
  const [justDone, setJustDone] = useState<number | null>(null);
  const done = completedDays(s);
  const tested = s.journey.testedOutUnits;
  const locked = !isLessonUnlocked(lesson.day, done, tested);
  const completed = !!s.lessonCompletions[lesson.day];
  const node = journeyNodes(done, tested).find((n) => n.day === lesson.day)!;
  const unit = UNITS.find((u) => u.n === node.unit)!;
  const next = nextLesson(done, tested);
  const widget = LESSON_WIDGETS[lesson.day];

  if (celebrate) return <Celebration />;
  if (justDone != null) return <LessonDone xp={justDone} next={next?.day ?? null} />;

  function finish() {
    if (completed) {
      navigate({ to: "/hoje" });
      return;
    }
    try {
      const r = demo.completeLesson(lesson.day);
      handleResult(r);
      if (r.programCompleted) setCelebrate(true);
      else setJustDone(r.xpAwarded);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-16 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          Unidade {unit.n} · Lição {String(node.indexInUnit).padStart(2, "0")} de {String(node.unitSize).padStart(2, "0")}
          <span className="ml-2 text-primary">+{XP.lesson_completed} XP</span>
        </p>
        <Button asChild variant="ghost" size="icon" aria-label="Fechar lição">
          <Link to="/hoje">
            <X strokeWidth={1.75} />
          </Link>
        </Button>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {unit.lessons.map((d) => (
          <span
            key={d}
            className={cn("h-1.5 flex-1 rounded-full", s.lessonCompletions[d] ? "bg-primary" : d === lesson.day ? "bg-primary/50" : "bg-border")}
          />
        ))}
      </div>

      {locked ? (
        <div className="mt-12">
          <h1>Esta lição ainda está bloqueada</h1>
          <p className="mt-3 text-muted-foreground">Ela abre quando você concluir as lições anteriores da trilha, ou passar no teste da unidade.</p>
          <Button asChild className="mt-6">
            {next ? (
              <Link to="/programa/$dia" params={{ dia: String(next.day) }}>
                Ir para a lição atual
              </Link>
            ) : (
              <Link to="/hoje">Voltar à jornada</Link>
            )}
          </Button>
        </div>
      ) : (
        <>
          <article className="mt-8">
            <h1>{lesson.title}</h1>
            <p className="mt-3 text-muted-foreground">{lesson.objective.charAt(0).toUpperCase() + lesson.objective.slice(1)}</p>
            <div className="mt-6 max-w-[70ch] space-y-4">
              {lesson.keyPoints.map((k) => (
                <p key={k}>{k}</p>
              ))}
            </div>
            <div className="mt-6 space-y-1 text-sm text-muted-foreground">
              {lesson.sources.length > 0 && (
                <p>
                  Fonte:{" "}
                  {lesson.sources.map((src, i) => (
                    <span key={src.url}>
                      {i > 0 && " · "}
                      <a href={src.url} target="_blank" rel="noreferrer" className="underline">
                        {src.label}
                      </a>
                    </span>
                  ))}
                </p>
              )}
              <p>Revisado em: aguardando revisão profissional (rascunho)</p>
            </div>
          </article>

          {widget && <LessonWidget kind={widget} />}
          <Questions lesson={lesson} />
          {lesson.actionKey && <DayAction lesson={lesson} />}
          {!lesson.actionKey && lesson.actionText && (
            <p className="mt-8 rounded-2xl bg-muted p-4 text-sm">
              <strong>Na prática:</strong> {lesson.actionText.charAt(0).toUpperCase() + lesson.actionText.slice(1)}
            </p>
          )}

          <Button className="mt-10 w-full" onClick={finish}>
            {completed ? "Voltar à jornada" : "Concluir lição"}
          </Button>
          <div className="mt-8">
            <LegalNote>{lessonFooter("—")}</LegalNote>
          </div>
        </>
      )}
    </main>
  );
}

function Questions({ lesson }: { lesson: Lesson }) {
  const s = useDemo();
  const [idx, setIdx] = useState(0);
  const found = lesson.questions[idx];
  if (!found) return null;
  const q: NonNullable<typeof found> = found;
  const key = `${lesson.day}-${idx + 1}`;
  const answer = s.answers[key];

  function pick(opt: string) {
    if (answer) return;
    const r = demo.answerQuestion(lesson.day, idx + 1, opt, q.correct);
    if (r.xpAwarded > 0) toast(`+${r.xpAwarded} XP`);
    handleResult(r);
  }

  return (
    <section className="mt-10 rounded-2xl bg-card shadow-card p-5" aria-label="Perguntas">
      <p className="text-sm text-muted-foreground">
        Pergunta {idx + 1} de {lesson.questions.length}
      </p>
      <h2 className="mt-2 text-lg">{q.prompt}</h2>
      <div className="mt-4 grid gap-2">
        {q.options.map((o) => {
          const chosen = answer?.selected === o.id;
          const isRight = answer && o.id === q.correct;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => pick(o.id)}
              disabled={!!answer}
              className={cn(
                "flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 text-left",
                !answer && "border-border hover:bg-muted",
                isRight && "border-primary font-semibold text-primary",
                chosen && !isRight && "border-muted-foreground text-muted-foreground",
                answer && !isRight && !chosen && "border-border opacity-60",
              )}
            >
              <span>{o.text}</span>
              {isRight && <Check size={18} strokeWidth={1.75} aria-label="Resposta correta" />}
            </button>
          );
        })}
      </div>
      {answer && (
        <div className="mt-4" aria-live="polite">
          <p className="font-semibold">{answer.correct ? "Isso mesmo." : "Não é essa."}</p>
          {q.explanation && <p className="mt-1 text-muted-foreground">{q.explanation}</p>}
          {idx < lesson.questions.length - 1 && (
            <Button variant="outline" className="mt-4" onClick={() => setIdx(idx + 1)}>
              Próxima pergunta
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function DayAction({ lesson }: { lesson: Lesson }) {
  const s = useDemo();
  const [age, setAge] = useState<number | null>(s.profile.goalRetirementAge ?? 60);
  const [income, setIncome] = useState<number | null>(s.profile.goalIncome);

  return (
    <section className="mt-8 rounded-2xl bg-muted p-5" aria-label="Na prática">
      <p className="text-sm font-semibold">Na prática</p>
      <p className="mt-1">{lesson.actionText}</p>
      {lesson.actionKey === "set_goal" && (
        <div className="mt-4 space-y-3">
          <NumberField label="Idade para se aposentar" value={age} onChange={setAge} suffix="anos" min={45} max={75} />
          <NumberField label="Renda mensal desejada, em valores de hoje" value={income} onChange={setIncome} prefix="R$" />
          <Button
            variant="outline"
            onClick={() => {
              demo.updateProfile({ goalRetirementAge: age, goalIncome: income });
              toast("Objetivo salvo.");
            }}
            disabled={!age || !income}
          >
            Salvar objetivo
          </Button>
        </div>
      )}
      {lesson.actionKey === "create_plan" && (
        <Button asChild variant="outline" className="mt-4">
          <Link to="/plano" search={{ criar: true }}>
            {s.plan ? "Ver meu plano" : "Montar meu plano"}
          </Link>
        </Button>
      )}
      {lesson.actionKey === "first_contribution" && (
        <div className="mt-4 space-y-3">
          <Button asChild variant="outline">
            <Link to="/diario" search={{ registrar: true }}>
              Registrar aporte
            </Link>
          </Button>
          <label className="flex min-h-11 items-center justify-between gap-4">
            <span>Lembrete mensal no dia {s.profile.reminderDay}</span>
            <Switch checked={s.profile.monthlyReminder} onCheckedChange={(v) => demo.updateProfile({ monthlyReminder: v })} />
          </label>
        </div>
      )}
    </section>
  );
}

function LessonDone({ xp, next }: { xp: number; next: number | null }) {
  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-[480px] flex-col items-center justify-center px-5 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check size={30} strokeWidth={2.25} aria-hidden />
      </span>
      <h1 className="mt-6">Lição concluída</h1>
      {xp > 0 && <p className="money mt-2 font-display text-2xl font-semibold text-primary">+{xp} XP</p>}
      <p className="mt-3 text-muted-foreground">Mais um passo na sua jornada. Pode seguir agora ou voltar amanhã.</p>
      <div className="mt-8 flex w-full flex-col gap-2">
        {next != null && (
          <Button asChild>
            <Link to="/programa/$dia" params={{ dia: String(next) }}>
              Próxima lição
            </Link>
          </Button>
        )}
        <Button asChild variant={next != null ? "outline" : "default"}>
          <Link to="/hoje">Voltar à jornada</Link>
        </Button>
      </div>
    </main>
  );
}

function Celebration() {
  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-[480px] flex-col items-center justify-center px-5 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Flag size={30} strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="mt-6">Jornada concluída</h1>
      <p className="mt-3 text-muted-foreground">
        Você passou pelas quatro unidades. Daqui em diante, missões do dia e da semana ajudam a revisar o plano e manter a constância.
      </p>
      <Button asChild className="mt-8 w-full">
        <Link to="/hoje">Ir para a jornada</Link>
      </Button>
    </main>
  );
}
