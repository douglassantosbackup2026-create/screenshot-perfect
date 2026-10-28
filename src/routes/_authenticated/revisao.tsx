import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Quiz, type QuizResult } from "@/components/Quiz";
import { handleResult, xpToast } from "@/components/feedback";
import { completedDays, dailyMissionDone, demo, todayMission, useDemo } from "@/lib/data/demo-store";
import { missionAccepts, REVIEW_PASS, reviewQuestions } from "@/lib/journey/journey";
import { spDate } from "@/lib/gamification/rules";
import { JOURNEY_ENABLED } from "@/lib/features";

export const Route = createFileRoute("/_authenticated/revisao")({
  beforeLoad: () => {
    if (!JOURNEY_ENABLED) throw redirect({ to: "/hoje", replace: true });
  },
  head: () => pageHead("Revisão", "Três perguntas rápidas sobre o que você já estudou."),
  component: Review,
});

function Review() {
  const s = useDemo();
  const today = spDate(new Date());
  // As perguntas do dia ficam fixas, mesmo se a pessoa concluir lições no meio da revisão.
  const [items] = useState(() => reviewQuestions(completedDays(s), today));
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<QuizResult | null>(null);
  const mission = todayMission(s);
  const counts = (mission.kind === "quiz" || mission.kind === "review") && !dailyMissionDone(s);
  const quizItems = useMemo(() => items.map((i) => ({ key: i.key, question: i.question })), [items]);

  function done(r: QuizResult) {
    setResult(r);
    if (r.correct >= REVIEW_PASS && counts && missionAccepts(mission, mission.kind)) {
      try {
        const res = demo.completeDailyMission(mission.kind, r.answers);
        xpToast("Missão do dia concluída.", res.xpAwarded);
        handleResult(res);
      } catch (e) {
        toast.error((e as Error).message);
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-16 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Revisão rápida</p>
        <Button asChild variant="ghost" size="icon" aria-label="Fechar revisão">
          <Link to="/hoje">
            <X strokeWidth={1.75} />
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="mt-12">
          <h1>Nada para revisar ainda</h1>
          <p className="mt-3 text-muted-foreground">Conclua uma lição e ela passa a aparecer nas revisões.</p>
          <Button asChild className="mt-6">
            <Link to="/hoje">Voltar à jornada</Link>
          </Button>
        </div>
      ) : result ? (
        <div className="mt-12" aria-live="polite">
          <h1>
            Você acertou {result.correct} de {result.total}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {result.correct >= REVIEW_PASS
              ? "Os conceitos estão firmes. A revisão mede o que você entendeu, não o tempo de tela."
              : `Para a revisão contar, acerte pelo menos ${REVIEW_PASS} de ${result.total}. Releia as explicações e tente de novo.`}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {result.correct < REVIEW_PASS && (
              <Button
                onClick={() => {
                  setResult(null);
                  setRound((r) => r + 1);
                }}
              >
                Tentar de novo
              </Button>
            )}
            <Button asChild variant={result.correct < REVIEW_PASS ? "outline" : "default"}>
              <Link to="/hoje">Voltar à jornada</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8">
          <Quiz key={round} items={quizItems} onDone={done} />
        </div>
      )}
    </main>
  );
}
