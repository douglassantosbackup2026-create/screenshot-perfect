import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LessonQuestion } from "@/content/program";
import { cn } from "@/lib/utils";

export type QuizItem = { key: string; question: LessonQuestion };
export type QuizResult = { answers: Record<string, string>; correct: number; total: number };

/** Uma pergunta por vez, com retorno imediato e explicação. Chama `onDone` ao final. */
export function Quiz({ items, onDone, doneLabel = "Ver resultado" }: { items: QuizItem[]; onDone: (r: QuizResult) => void; doneLabel?: string }) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const item = items[idx];
  if (!item) return null;
  const q = item.question;
  const picked = answers[item.key];
  const last = idx === items.length - 1;

  function finish() {
    const correct = items.filter((i) => answers[i.key] === i.question.correct).length;
    onDone({ answers, correct, total: items.length });
  }

  return (
    <section aria-label="Perguntas">
      <div className="flex gap-1" aria-hidden>
        {items.map((it, i) => (
          <span
            key={it.key}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i < idx || (i === idx && picked) ? "bg-primary" : i === idx ? "bg-primary/40" : "bg-border",
            )}
          />
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Pergunta {idx + 1} de {items.length}
      </p>
      <h2 className="mt-2 text-lg">{q.prompt}</h2>
      <div className="mt-4 grid gap-2">
        {q.options.map((o) => {
          const chosen = picked === o.id;
          const isRight = !!picked && o.id === q.correct;
          return (
            <button
              key={o.id}
              type="button"
              disabled={!!picked}
              onClick={() => setAnswers((a) => ({ ...a, [item.key]: o.id }))}
              className={cn(
                "flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 text-left",
                !picked && "border-border hover:bg-muted",
                isRight && "border-primary font-semibold text-primary",
                chosen && !isRight && "border-muted-foreground text-muted-foreground",
                picked && !isRight && !chosen && "border-border opacity-60",
              )}
            >
              <span>{o.text}</span>
              {isRight && <Check size={18} strokeWidth={1.75} aria-label="Resposta correta" />}
            </button>
          );
        })}
      </div>
      {picked && (
        <div className="mt-4" aria-live="polite">
          <p className="font-semibold">{picked === q.correct ? "Isso mesmo." : "Não é essa."}</p>
          {q.explanation && <p className="mt-1 text-muted-foreground">{q.explanation}</p>}
          <Button className="mt-4 w-full" onClick={() => (last ? finish() : setIdx(idx + 1))}>
            {last ? doneLabel : "Próxima pergunta"}
          </Button>
        </div>
      )}
    </section>
  );
}
