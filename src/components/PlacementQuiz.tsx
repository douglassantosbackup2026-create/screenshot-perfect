import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BottomSheetContent } from "@/components/BottomSheet";
import { Quiz, type QuizResult } from "@/components/Quiz";
import { handleResult } from "@/components/feedback";
import { demo } from "@/lib/data/demo-store";
import { placementQuestions } from "@/lib/journey/journey";
import { UNITS } from "@/content/journey";

/** Teste de nivelamento de uma unidade: acertando todas, as lições dela ficam abertas e a próxima unidade libera. */
export function PlacementQuiz({ unit, onClose }: { unit: number | null; onClose: () => void }) {
  const [result, setResult] = useState<{ passed: boolean; correct: number; total: number } | null>(null);
  const u = UNITS.find((x) => x.n === unit);
  if (!u) return null;

  function done(r: QuizResult) {
    try {
      const res = demo.submitPlacement(u!.n, r.answers);
      handleResult(res);
      setResult(res);
    } catch (e) {
      toast.error((e as Error).message);
      onClose();
    }
  }

  function close() {
    setResult(null);
    onClose();
  }

  return (
    <Sheet open onOpenChange={(o) => !o && close()}>
      <BottomSheetContent>
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">Já sabe isso? Unidade {u.n}</SheetTitle>
          <SheetDescription>
            Acerte as {u.placement.length} perguntas para liberar a próxima unidade. As lições continuam abertas para quando quiser.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 pb-4">
          {result ? (
            <div aria-live="polite">
              <p className="text-lg font-semibold">{result.passed ? "Unidade liberada." : `Você acertou ${result.correct} de ${result.total}.`}</p>
              <p className="mt-2 text-muted-foreground">
                {result.passed
                  ? "Você pode seguir para a próxima unidade. O teste não dá XP: o XP vem das lições que você fizer."
                  : "Sem problema: as lições desta unidade vão direto ao ponto. Você pode tentar o teste de novo depois."}
              </p>
              <Button className="mt-6 w-full" onClick={close}>
                Voltar à jornada
              </Button>
            </div>
          ) : (
            <Quiz items={placementQuestions(u.n)} onDone={done} />
          )}
        </div>
      </BottomSheetContent>
    </Sheet>
  );
}
