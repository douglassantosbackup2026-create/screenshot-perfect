// "Com quantos anos posso parar?": a menor idade em que o patrimônio já paga a renda desejada.
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Blurred } from "@/components/Upgrade";
import { earliestRetirementAge, type PlanInputs, type ScenarioKey } from "@/lib/calc/retirement";
import { formatAgeMonths, formatMonthly, formatWealth } from "@/lib/calc/format";

export function GoalSeekCard({
  inputs,
  scenario,
  includeInss,
  onUseAge,
}: {
  inputs: PlanInputs;
  scenario: ScenarioKey;
  includeInss: boolean;
  onUseAge: (age: number) => void;
}) {
  const r = useMemo(
    () => earliestRetirementAge(inputs, scenario, includeInss),
    [inputs, scenario, includeInss],
  );
  const wholeAge = r ? Math.ceil(r.age) : null;
  return (
    <section
      className="mt-4 rounded-2xl bg-card p-5 shadow-card"
      aria-label="Com quantos anos posso parar"
    >
      <h2 className="text-base">Com quantos anos posso parar?</h2>
      <Blurred feature="goal_seek">
        {r ? (
          <>
            <p className="mt-2 font-display text-3xl font-semibold text-primary">
              {formatAgeMonths(r.age)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Guardando <span className="money">{formatMonthly(inputs.monthlyContribution)}</span>{" "}
              por mês, nessa idade o patrimônio chega a cerca de{" "}
              <span className="money">{formatWealth(r.result.projectedWealthAtRetirement)}</span> e
              já paga <span className="money">{formatMonthly(inputs.desiredMonthlyIncome)}</span>{" "}
              por mês até os {inputs.horizonAge} anos. Você planejou parar aos{" "}
              {inputs.retirementAge}.
            </p>
            {wholeAge !== null &&
              wholeAge !== inputs.retirementAge &&
              wholeAge < inputs.horizonAge && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => onUseAge(wholeAge)}
                >
                  Testar aposentar aos {wholeAge}
                </Button>
              )}
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Com o aporte de hoje, nenhuma idade antes dos {inputs.horizonAge} anos fecha a conta
            neste cenário. Aumentar o aporte ou rever a renda desejada muda isso.
          </p>
        )}
      </Blurred>
    </section>
  );
}
