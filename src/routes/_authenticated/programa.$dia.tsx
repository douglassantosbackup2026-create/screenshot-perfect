import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Check, Flag, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { NumberField, LegalNote } from "@/components/forms";
import { handleResult, xpToast } from "@/components/feedback";
import { demo, useDemo } from "@/lib/data/demo-store";
import { LESSONS, PROGRAM, type Lesson } from "@/content/program";
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
      { title: loaderData ? `Dia ${loaderData.lesson.day}: ${loaderData.lesson.title}` : "Lição — Previdência Intelligence" },
      { name: "description", content: loaderData?.lesson.objective ?? "Lição do programa de 21 dias." },
      { property: "og:title", content: loaderData ? `Dia ${loaderData.lesson.day}: ${loaderData.lesson.title}` : "Lição" },
      { property: "og:description", content: loaderData?.lesson.objective ?? "Lição do programa de 21 dias." },
    ],
  }),
  component: LessonPage,
});

function LessonPage() {
  const { lesson } = Route.useLoaderData();
  const s = useDemo();
  const navigate = useNavigate();
  const [celebrate, setCelebrate] = useState(false);
  const locked = lesson.day > s.program.currentDay;
  const completed = !!s.lessonCompletions[lesson.day];

  if (celebrate) return <Celebration />;

  function finish() {
    try {
      const r = demo.completeLesson(lesson.day);
      xpToast(`Dia ${lesson.day} concluído.`, r.xpAwarded);
      handleResult(r);
      if (r.programCompleted && lesson.day === PROGRAM.totalDays) setCelebrate(true);
      else navigate({ to: "/hoje" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-16 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          Dia {lesson.day} de {PROGRAM.totalDays}
        </p>
        <Button asChild variant="ghost" size="icon" aria-label="Fechar lição">
          <Link to="/hoje">
            <X strokeWidth={1.75} />
          </Link>
        </Button>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {Array.from({ length: PROGRAM.totalDays }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              s.lessonCompletions[i + 1] ? "bg-primary" : i + 1 === lesson.day ? "bg-primary/50" : "bg-border",
            )}
          />
        ))}
      </div>

      {locked ? (
        <div className="mt-12">
          <h1>Esta lição ainda não abriu</h1>
          <p className="mt-3 text-muted-foreground">Uma lição nova abre por dia. Continue de onde você parou.</p>
          <Button asChild className="mt-6">
            <Link to="/programa/$dia" params={{ dia: String(s.program.currentDay) }}>
              Ir para o dia {Math.min(s.program.currentDay, PROGRAM.totalDays)}
            </Link>
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

          <Questions lesson={lesson} />
          {lesson.actionKey && <DayAction lesson={lesson} />}
          {!lesson.actionKey && lesson.actionText && (
            <p className="mt-8 rounded-2xl bg-muted p-4 text-sm">
              <strong>Ação do dia:</strong> {lesson.actionText.charAt(0).toUpperCase() + lesson.actionText.slice(1)}
            </p>
          )}

          <Button className="mt-10 w-full" onClick={finish}>
            {completed ? "Voltar para Hoje" : `Concluir dia ${lesson.day}`}
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
  const q = lesson.questions[idx];
  if (!q) return null;
  const key = `${lesson.day}-${idx + 1}`;
  const answer = s.answers[key];

  function pick(opt: string) {
    if (answer) return;
    const r = demo.answerQuestion(lesson.day, idx + 1, opt, q.correct);
    if (r.xpAwarded > 0) toast(`+${r.xpAwarded} XP`);
    handleResult(r);
  }

  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-5" aria-label="Perguntas">
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
                "flex min-h-12 items-center justify-between gap-3 rounded-[10px] border px-4 text-left",
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
    <section className="mt-8 rounded-2xl bg-muted p-5" aria-label="Ação do dia">
      <p className="text-sm font-semibold">Ação do dia</p>
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

function Celebration() {
  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-[480px] flex-col items-center justify-center px-5 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Flag size={30} strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="mt-6">21 dias concluídos</h1>
      <p className="mt-3 text-muted-foreground">
        Você terminou o programa Meu plano sem depender do INSS. A partir de agora, uma missão por semana.
      </p>
      <Button asChild className="mt-8 w-full">
        <Link to="/hoje">Ir para Hoje</Link>
      </Button>
    </main>
  );
}
