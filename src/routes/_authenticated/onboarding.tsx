import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { pageHead, APP_NAME } from "@/lib/seo";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { NumberField } from "@/components/forms";
import { runAction } from "@/components/feedback";
import { demo, inputsFromProfile, CALC_PREFILL_KEY, type CalcPrefill, type MissingField } from "@/lib/data/demo-store";
import { ENGINE_VERSION, simulate, validateInputs, type PlanInputs } from "@/lib/calc/retirement";
import { formatMonthly, formatPercent, formatWealth } from "@/lib/calc/format";
import { Quiz, type QuizResult } from "@/components/Quiz";
import { gradePlacement, placementQuestions } from "@/lib/journey/journey";
import { UNITS } from "@/content/journey";
import { JOURNEY_ENABLED } from "@/lib/features";
import { spDate } from "@/lib/gamification/rules";
import { PillarCards } from "@/components/PillarCards";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => pageHead("Começar", "Algumas perguntas rápidas para começar sua jornada."),
  component: Onboarding,
});

/** Etapas, na ordem. 10 é o resultado. As que vierem preenchidas da calculadora são puladas. */
const BASE_FLOW = [1, 5, 6, 7, 10] as const;
const RESULT = 10;
/** Etapas que aceitam "pular por enquanto"; o dado fica marcado como ausente, nunca inventado. */
const SKIPPABLE: Record<number, MissingField[]> = { 6: ["renda"], 7: ["patrimonio", "aporte"] };
const MISSING_TEXT: Record<MissingField, string> = {
  idade: "idade (usamos 30 anos provisoriamente)",
  renda: "renda desejada (usamos R$ 5.000 provisoriamente)",
  patrimonio: "patrimônio atual (considerado R$ 0)",
  aporte: "aporte mensal (considerado R$ 0)",
};

function Onboarding() {
  const navigate = useNavigate();
  // Boas-vindas com os três pilares, antes das perguntas; não conta no progresso.
  const [intro, setIntro] = useState(true);
  const [step, setStep] = useState(1);
  // Teste de nivelamento opcional (só com a jornada ligada), logo depois da primeira etapa.
  const [placement, setPlacement] = useState<"intro" | number | null>(null);
  const [passed, setPassed] = useState<Record<number, Record<string, string>>>({});
  const [name, setName] = useState("");
  const [wealth, setWealth] = useState<number | null>(null);
  const [contribution, setContribution] = useState<number | null>(null);
  const [missing, setMissing] = useState<MissingField[]>([]);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [retire, setRetire] = useState(60);
  const [income, setIncome] = useState<number | null>(null);
  const [inss, setInss] = useState<number | null>(null);
  const [prefilled, setPrefilled] = useState({ retire: false, income: false, money: false });
  const year = Number(spDate(new Date()).slice(0, 4));

  // O que veio da calculadora já preenche as etapas; a pessoa só confirma.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CALC_PREFILL_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as CalcPrefill;
      if (p.currentAge) setBirthYear(year - p.currentAge);
      // Fora da faixa da etapa (45 a 75), fica no limite mais próximo em vez de ser ignorada.
      if (p.retirementAge) setRetire(Math.min(Math.max(p.retirementAge, 45), 75));
      if (p.desiredIncome) setIncome(p.desiredIncome);
      if (p.initialWealth != null) setWealth(p.initialWealth);
      if (p.monthlyContribution != null) setContribution(p.monthlyContribution);
      if (p.inssEstimate) setInss(p.inssEstimate);
      setPrefilled({
        retire: !!p.retirementAge,
        income: !!p.desiredIncome,
        money: p.initialWealth != null && p.monthlyContribution != null,
      });
    } catch {
      /* ignora */
    }
  }, [year]);

  const age = birthYear ? year - birthYear : null;
  const valid: Record<number, boolean> = {
    // O ano de nascimento é opcional: em branco, a idade fica como dado faltante.
    1: name.trim().length > 0 && name.trim().length <= 60 && (birthYear == null || (birthYear >= 1930 && birthYear <= 2015)),
    5: retire >= 45 && retire <= 75 && (age == null || retire > age),
    6: income != null && income > 0,
    7: wealth != null && wealth >= 0 && contribution != null && contribution >= 0,
    10: true,
  };
  const flow = BASE_FLOW.filter((n) => !(n === 5 && prefilled.retire) && !(n === 6 && prefilled.income) && !(n === 7 && prefilled.money));
  const position = Math.max(flow.indexOf(step as (typeof BASE_FLOW)[number]), 0);
  const goNext = () => setStep(flow[position + 1] ?? RESULT);
  const questions = flow.length - 1;
  const done = step === RESULT;

  const birthYearKnown = missing.includes("idade") ? null : birthYear;
  const incomeKnown = missing.includes("renda") ? null : income;
  const base = inputsFromProfile({ birthYear: birthYearKnown, goalRetirementAge: retire, goalIncome: incomeKnown });
  const inputs: PlanInputs = {
    ...base,
    // A idade provisória pode passar da idade escolhida; garante ao menos 1 ano até a aposentadoria.
    retirementAge: Math.max(base.retirementAge, base.currentAge + 1),
    initialWealth: missing.includes("patrimonio") ? 0 : (wealth ?? 0),
    monthlyContribution: missing.includes("aporte") ? 0 : (contribution ?? 0),
    inssEstimate: inss,
  };

  function skip() {
    const fields = SKIPPABLE[step] ?? [];
    setMissing((m) => [...new Set([...m, ...fields])]);
    goNext();
  }
  function next() {
    const fields = step === 1 ? (["idade"] as MissingField[]) : SKIPPABLE[step];
    if (step === 1 && birthYear == null) setMissing((m) => [...new Set([...m, "idade" as const])]);
    else if (fields) setMissing((m) => m.filter((f) => !fields.includes(f)));
    if (JOURNEY_ENABLED && step === 1 && placement === null) {
      setPlacement("intro");
      return;
    }
    goNext();
  }
  function endPlacement() {
    setPlacement(null);
    goNext();
  }
  function placementDone(unit: number, r: QuizResult) {
    if (!gradePlacement(unit, r.answers).passed) return setPlacement(-unit);
    setPassed((p) => ({ ...p, [unit]: r.answers }));
    const nextUnit = UNITS.find((u) => u.n === unit + 1 && u.placement.length > 0);
    if (nextUnit) setPlacement(-(1000 + unit));
    else endPlacement();
  }
  function back() {
    if (placement !== null) {
      setPassed({});
      return setPlacement(null);
    }
    if (intro) return navigate({ to: "/" });
    if (position === 0) return setIntro(true);
    setStep(flow[position - 1] ?? 1);
  }
  function finish() {
    // Confere o plano antes de apagar qualquer coisa: um erro aqui não pode deixar a conta pela metade.
    const invalid = validateInputs(inputs);
    if (invalid.length) return void toast.error(invalid[0]);
    demo.startFresh();
    demo.updateProfile({
      displayName: name.trim(),
      birthYear: birthYearKnown,
      // Tipo de trabalho, dívidas, objetivo e dia do pagamento ficam em aberto: o app pede depois,
      // quando fizer diferença. Lembretes ficam desligados até existir envio de verdade.
      workType: null,
      hasOverdueDebt: null,
      monthlyReminder: false,
      weeklyReminder: false,
      goalRetirementAge: retire,
      goalIncome: incomeKnown,
      objective: null,
      missingFields: missing,
    });
    if (!runAction(() => demo.savePlan(inputs, "created"))) return;
    // Reenvia, em ordem, as unidades em que a pessoa passou no teste (mesma regra do banco).
    // Um teste recusado não impede de terminar: a pessoa só refaz aquela unidade.
    for (const u of Object.keys(passed).map(Number).sort((a, b) => a - b)) {
      try {
        demo.submitPlacement(u, passed[u]!);
      } catch {
        /* unidade fica para fazer na jornada */
      }
    }
    // Só marca como concluído no fim, com perfil e plano gravados.
    demo.updateProfile({ onboardingCompletedAt: new Date().toISOString() });
    sessionStorage.removeItem(CALC_PREFILL_KEY);
    navigate({ to: "/hoje" });
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-28px)] w-full max-w-[480px] flex-col px-5 pb-8 pt-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Voltar">
          <ArrowLeft strokeWidth={1.75} />
        </Button>
        {!intro && (
          <>
            <Progress value={done ? 100 : ((position + 1) / questions) * 100} className="h-1.5 flex-1" aria-label={done ? "Plano pronto" : `Pergunta ${position + 1} de ${questions}`} />
            <span className="w-12 text-right text-xs text-muted-foreground">
              {done ? "Pronto" : `${position + 1}/${questions}`}
            </span>
          </>
        )}
      </div>

      <div className="flex flex-1 flex-col pt-10">
        {intro ? (
          <div>
            <h1>Boas-vindas ao {APP_NAME}</h1>
            <p className="mt-3 text-muted-foreground">Seu orçamento, seu patrimônio e sua aposentadoria, num app só.</p>
            <div className="mt-6">
              <PillarCards show="where" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">Vamos começar pelo plano de aposentadoria: são quatro perguntas rápidas.</p>
          </div>
        ) : placement !== null ? (
          <PlacementStep
            state={placement}
            passedCount={Object.keys(passed).length}
            onStart={(u) => setPlacement(u)}
            onDone={placementDone}
            onSkip={endPlacement}
          />
        ) : (
          <Step
            step={step}
            {...{ name, setName, birthYear, setBirthYear, age, retire, setRetire, income, setIncome, wealth, setWealth, contribution, setContribution, inputs, missing }}
          />
        )}

        {intro ? (
          <div className="mt-auto pt-10">
            <Button className="w-full" onClick={() => setIntro(false)}>
              Começar
            </Button>
          </div>
        ) : placement === null && (
          <div className="mt-auto pt-10">
            {step !== RESULT ? (
              <div className="flex flex-col gap-2">
                <Button className="w-full" onClick={next} disabled={!valid[step]}>
                  Continuar
                </Button>
                {SKIPPABLE[step] && (
                  <Button variant="ghost" className="w-full" onClick={skip}>
                    Pular por enquanto
                  </Button>
                )}
              </div>
            ) : (
              <Button className="w-full" onClick={finish}>
                {JOURNEY_ENABLED ? "Salvar plano e começar a jornada" : "Salvar meu plano"}
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

type Setter<T> = (v: T) => void;
/** O estado do onboarding, repassado a cada etapa. */
type StepProps = {
  step: number;
  name: string;
  setName: Setter<string>;
  birthYear: number | null;
  setBirthYear: Setter<number | null>;
  age: number | null;
  retire: number;
  setRetire: Setter<number>;
  income: number | null;
  setIncome: Setter<number | null>;
  wealth: number | null;
  setWealth: Setter<number | null>;
  contribution: number | null;
  setContribution: Setter<number | null>;
  inputs: PlanInputs;
  missing: MissingField[];
};

function Step(p: StepProps) {
  switch (p.step) {
    case 1:
      return (
        <div>
          <h1>Vamos montar o seu plano</h1>
          <p className="mt-3 text-muted-foreground">Quatro perguntas rápidas. Dá para mudar tudo depois.</p>
          <div className="mt-6 grid gap-4">
            <div>
              <label htmlFor="name" className="text-sm font-semibold">
                Como você quer ser chamado?
              </label>
              <Input id="name" autoFocus maxLength={60} value={p.name} onChange={(e) => p.setName(e.target.value)} className="mt-1.5 h-12 text-lg" />
            </div>
            <NumberField label="Ano de nascimento" value={p.birthYear} onChange={p.setBirthYear} min={1930} max={2015} step={1} optional />
          </div>
          {p.age != null && p.birthYear != null && p.birthYear >= 1930 && p.birthYear <= 2015 && <p className="mt-3 text-muted-foreground">Você tem {p.age} anos.</p>}
        </div>
      );
    case 5:
      return (
        <div>
          <h1>Com quantos anos você gostaria de se aposentar?</h1>
          <p className="money mt-8 text-center font-display text-5xl font-semibold text-primary">{p.retire}</p>
          <p className="text-center text-muted-foreground">anos</p>
          <Slider
            className="mt-8"
            min={45}
            max={75}
            step={1}
            value={[p.retire]}
            onValueChange={(v) => v[0] != null && p.setRetire(v[0])}
            aria-label="Idade para se aposentar"
          />
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>45</span>
            <span>75</span>
          </div>
          {p.age != null && p.retire <= p.age && <p className="mt-4 text-sm text-destructive">Escolha uma idade maior que a sua idade atual.</p>}
        </div>
      );
    case 6:
      return (
        <div>
          <h1>Quanto você gostaria de ter por mês, em valores de hoje?</h1>
          <div className="mt-6">
            <NumberField label="Renda mensal desejada" value={p.income} onChange={p.setIncome} prefix="R$" step={100} hint="Um bom ponto de partida é a sua renda atual." />
          </div>
        </div>
      );
    case 7:
      return (
        <div>
          <h1>Quanto você já tem e quanto guarda por mês?</h1>
          <p className="mt-3 text-muted-foreground">Considere só o que você pretende usar na aposentadoria. Se não souber agora, pule e preencha depois.</p>
          <div className="mt-6 grid gap-4">
            <NumberField label="Patrimônio atual para a aposentadoria" value={p.wealth} onChange={p.setWealth} prefix="R$" step={1000} min={0} />
            <NumberField label="Aporte mensal previsto" value={p.contribution} onChange={p.setContribution} prefix="R$" step={100} min={0} hint="Pode ser R$ 0." />
          </div>
        </div>
      );
    default:
      return <FirstProjection inputs={p.inputs} missing={p.missing} />;
  }
}

function FirstProjection({ inputs, missing }: { inputs: PlanInputs; missing: MissingField[] }) {
  const r = simulate(inputs, "central", false);
  return (
    <div>
      <h1>Sua primeira estimativa</h1>
      <p className="mt-3 text-muted-foreground">Cenário central, com base nas premissas abaixo. É uma estimativa, não uma promessa.</p>
      <div className="mt-6 grid gap-3">
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Patrimônio estimado aos {inputs.retirementAge} anos, em reais de hoje</p>
          <p className="money font-display text-3xl font-semibold text-primary">{formatWealth(r.projectedWealthAtRetirement)}</p>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <p className="text-sm text-muted-foreground">Renda mensal que esse patrimônio sustentaria até os {inputs.horizonAge} anos</p>
          <p className="money font-display text-2xl font-semibold">{formatMonthly(r.sustainableMonthlyIncome)}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Você quer {formatMonthly(inputs.desiredMonthlyIncome)}. Neste cenário, o aporte necessário seria de cerca de {formatMonthly(r.requiredMonthlyContribution)} por mês.
          </p>
        </div>
      </div>
      <p className="mt-6 text-sm font-semibold">O que mais pesa no resultado</p>
      <p className="mt-1 text-sm text-muted-foreground">O prazo até a aposentadoria, o valor do aporte e o retorno real (acima da inflação). Você pode testar cada um no seu plano.</p>
      <p className="mt-6 text-sm font-semibold">Premissas</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Retorno real de {formatPercent(inputs.returns.central)} ao ano, já descontada a inflação</li>
        <li>Inflação de {formatPercent(inputs.inflationAA)} ao ano, usada só para mostrar valores futuros</li>
        <li>Sem INSS: o plano considera só o seu patrimônio</li>
        <li>Dinheiro durando até os {inputs.horizonAge} anos · motor {ENGINE_VERSION}</li>
      </ul>
      {missing.length > 0 && (
        <div className="mt-6 rounded-2xl bg-muted p-4 text-sm">
          <p className="font-semibold">Faltam dados</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {missing.map((m) => (
              <li key={m}>{MISSING_TEXT[m]}</li>
            ))}
          </ul>
          <p className="mt-2 text-muted-foreground">Complete no seu plano para a estimativa ficar mais fiel.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Estados: "intro"; n > 0 = fazendo o teste da unidade n; -n = reprovou na unidade n;
 * -(1000 + n) = passou na unidade n e pode tentar a seguinte.
 */
function PlacementStep({
  state,
  passedCount,
  onStart,
  onDone,
  onSkip,
}: {
  state: "intro" | number;
  passedCount: number;
  onStart: (unit: number) => void;
  onDone: (unit: number, r: QuizResult) => void;
  onSkip: () => void;
}) {
  if (state === "intro") {
    return (
      <div>
        <h1>Quer testar o que já sabe?</h1>
        <p className="mt-3 text-muted-foreground">
          Se você já entende de juros, inflação e planejamento, um teste rápido libera as unidades seguintes. Ninguém precisa começar do zero.
        </p>
        <div className="mt-8 flex flex-col gap-2">
          <Button onClick={() => onStart(1)}>Fazer o teste (3 perguntas)</Button>
          <Button variant="outline" onClick={onSkip}>
            Começar do início
          </Button>
        </div>
      </div>
    );
  }
  if (state > 0) {
    const u = UNITS.find((x) => x.n === state)!;
    return (
      <div>
        <p className="eyebrow">Teste · Unidade {u.n}</p>
        <h1 className="mt-1 text-2xl">{u.title}</h1>
        <div className="mt-6">
          <Quiz key={u.n} items={placementQuestions(u.n)} onDone={(r) => onDone(u.n, r)} doneLabel="Ver resultado" />
        </div>
      </div>
    );
  }
  const passedNext = state <= -1000;
  const unit = passedNext ? -state - 1000 : -state;
  return (
    <div aria-live="polite">
      <h1>{passedNext ? `Unidade ${unit} liberada` : "Bom ponto de partida"}</h1>
      <p className="mt-3 text-muted-foreground">
        {passedNext
          ? "Quer tentar a próxima unidade ou seguir daqui?"
          : passedCount > 0
            ? `Você começa a partir da Unidade ${unit}. As lições vão direto ao ponto.`
            : "Você começa pela Unidade 1. As lições são curtas e vão direto ao ponto."}
      </p>
      <div className="mt-8 flex flex-col gap-2">
        {passedNext && <Button onClick={() => onStart(unit + 1)}>Testar a Unidade {unit + 1}</Button>}
        <Button variant={passedNext ? "outline" : "default"} onClick={onSkip}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
