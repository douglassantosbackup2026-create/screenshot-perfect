import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { NumberField } from "@/components/forms";
import { demo, inputsFromProfile, CALC_PREFILL_KEY, type CalcPrefill, type MissingField, type Objective, type ReviewCadence, type WorkType } from "@/lib/data/demo-store";
import { ENGINE_VERSION, simulate, type PlanInputs } from "@/lib/calc/retirement";
import { formatMonthly, formatPercent, formatWealth } from "@/lib/calc/format";
import { Quiz, type QuizResult } from "@/components/Quiz";
import { gradePlacement, placementQuestions } from "@/lib/journey/journey";
import { UNITS } from "@/content/journey";
import { WORK_TYPES } from "@/lib/labels";
import { spDate } from "@/lib/gamification/rules";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Começar — Previdência Intelligence" },
      { name: "description", content: "Algumas perguntas rápidas para começar sua jornada." },
      { property: "og:title", content: "Começar — Previdência Intelligence" },
      { property: "og:description", content: "Algumas perguntas rápidas para começar sua jornada." },
    ],
  }),
  component: Onboarding,
});

type Debt = "sim" | "nao" | "prefiro_nao";
const TOTAL = 10;
/** Etapas que aceitam "pular por enquanto"; o dado fica marcado como ausente, nunca inventado. */
const SKIPPABLE: Record<number, MissingField[]> = { 3: ["idade"], 6: ["renda"], 7: ["patrimonio", "aporte"] };
const OBJECTIVES: { value: Objective; label: string }[] = [
  { value: "entender", label: "Entender quanto preciso para me aposentar" },
  { value: "organizar", label: "Organizar meu patrimônio" },
  { value: "previdencia", label: "Avaliar previdência privada (PGBL e VGBL)" },
];
const CADENCES: { value: ReviewCadence; label: string }[] = [
  { value: "mensal", label: "Todo mês" },
  { value: "trimestral", label: "A cada 3 meses" },
  { value: "semestral", label: "A cada 6 meses" },
];
const MISSING_TEXT: Record<MissingField, string> = {
  idade: "idade (usamos 30 anos provisoriamente)",
  renda: "renda desejada (usamos R$ 5.000 provisoriamente)",
  patrimonio: "patrimônio atual (considerado R$ 0)",
  aporte: "aporte mensal (considerado R$ 0)",
};

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [debtScreen, setDebtScreen] = useState(false);
  // Teste de nivelamento opcional, como uma tela extra da etapa do objetivo.
  const [placement, setPlacement] = useState<"intro" | number | null>(null);
  const [passed, setPassed] = useState<Record<number, Record<string, string>>>({});
  const [showTips, setShowTips] = useState(false);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState<Objective | null>(null);
  const [wealth, setWealth] = useState<number | null>(null);
  const [contribution, setContribution] = useState<number | null>(null);
  const [cadence, setCadence] = useState<ReviewCadence>("trimestral");
  const [missing, setMissing] = useState<MissingField[]>([]);
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [work, setWork] = useState<WorkType | null>(null);
  const [retire, setRetire] = useState(60);
  const [income, setIncome] = useState<number | null>(null);
  const [debt, setDebt] = useState<Debt | null>(null);
  const [day, setDay] = useState<number | null>(5);
  const [weekly, setWeekly] = useState(true);
  const [inss, setInss] = useState<number | null>(null);
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
    } catch {
      /* ignora */
    }
  }, [year]);

  const age = birthYear ? year - birthYear : null;
  const valid: Record<number, boolean> = {
    1: name.trim().length > 0 && name.trim().length <= 60,
    2: objective != null,
    3: birthYear != null && birthYear >= 1930 && birthYear <= 2015,
    4: work != null,
    5: retire >= 45 && retire <= 75 && (age == null || retire > age),
    6: income != null && income > 0,
    7: wealth != null && wealth >= 0 && contribution != null && contribution >= 0,
    8: debt != null,
    9: day != null && day >= 1 && day <= 28,
    10: true,
  };

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
    setStep((s) => Math.min(TOTAL, s + 1));
  }
  function next() {
    const fields = SKIPPABLE[step];
    if (fields) setMissing((m) => m.filter((f) => !fields.includes(f)));
    if (step === 2 && placement === null) {
      setPlacement("intro");
      return;
    }
    if (step === 8 && debt === "sim" && !debtScreen) {
      setDebtScreen(true);
      return;
    }
    setDebtScreen(false);
    setStep((s) => Math.min(TOTAL, s + 1));
  }
  function endPlacement() {
    setPlacement(null);
    setStep(3);
  }
  function placementDone(unit: number, r: QuizResult) {
    if (!gradePlacement(unit, r.answers).passed) return setPlacement(-unit);
    setPassed((p) => ({ ...p, [unit]: r.answers }));
    const nextUnit = UNITS.find((u) => u.n === unit + 1 && u.placement.length > 0);
    if (nextUnit) setPlacement(-(1000 + unit));
    else endPlacement();
  }
  function back() {
    if (debtScreen) return setDebtScreen(false);
    if (placement !== null) {
      setPassed({});
      return setPlacement(null);
    }
    if (step === 1) return navigate({ to: "/" });
    setStep((s) => s - 1);
  }
  function finish() {
    demo.startFresh();
    demo.updateProfile({
      displayName: name.trim(),
      birthYear: birthYearKnown,
      workType: work,
      hasOverdueDebt: debt === "sim" ? true : debt === "nao" ? false : null,
      reminderDay: day ?? 5,
      monthlyReminder: true,
      weeklyReminder: weekly,
      onboardingCompletedAt: new Date().toISOString(),
      goalRetirementAge: retire,
      goalIncome: incomeKnown,
      objective,
      reviewCadence: cadence,
      missingFields: missing,
    });
    demo.savePlan(inputs, "created");
    // Reenvia, em ordem, as unidades em que a pessoa passou no teste (mesma regra do banco).
    for (const u of Object.keys(passed).map(Number).sort((a, b) => a - b)) demo.submitPlacement(u, passed[u]!);
    sessionStorage.removeItem(CALC_PREFILL_KEY);
    navigate({ to: "/hoje" });
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-28px)] w-full max-w-[480px] flex-col px-5 pb-8 pt-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Voltar">
          <ArrowLeft strokeWidth={1.75} />
        </Button>
        <Progress value={(step / TOTAL) * 100} className="h-1.5 flex-1" aria-label={`Etapa ${step} de ${TOTAL}`} />
        <span className="w-10 text-right text-xs text-muted-foreground">
          {step}/{TOTAL}
        </span>
      </div>

      <div className="flex flex-1 flex-col pt-10">
        {placement !== null ? (
          <PlacementStep
            state={placement}
            passedCount={Object.keys(passed).length}
            onStart={(u) => setPlacement(u)}
            onDone={placementDone}
            onSkip={endPlacement}
          />
        ) : debtScreen ? (
          <div>
            <h1>Antes de tudo, vale cuidar disso</h1>
            <ol className="mt-6 list-decimal space-y-3 pl-5">
              <li>Liste todas as dívidas, com valor e juros de cada uma.</li>
              <li>Priorize quitar as de juros mais altos, como cartão e cheque especial.</li>
              <li>Renegocie direto com o credor ou em canais oficiais, como o Desenrola e o consumidor.gov.br.</li>
            </ol>
            {showTips && (
              <div className="mt-6 rounded-2xl bg-muted p-4 text-sm leading-6">
                <p className="font-semibold">Dicas para organizar dívidas</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Evite pegar um empréstimo novo para pagar outro, a não ser que os juros sejam bem menores.</li>
                  <li>Peça o valor total para quitar à vista: costuma haver desconto.</li>
                  <li>Desconfie de quem cobra para "limpar seu nome".</li>
                </ul>
              </div>
            )}
            <div className="mt-8 flex flex-col gap-2">
              <Button onClick={next}>Continuar</Button>
              {!showTips && (
                <Button variant="outline" onClick={() => setShowTips(true)}>
                  Ver dicas para organizar dívidas
                </Button>
              )}
            </div>
          </div>
        ) : (
          <Step
            step={step}
            {...{ name, setName, objective, setObjective, birthYear, setBirthYear, age, work, setWork, retire, setRetire, income, setIncome, wealth, setWealth, contribution, setContribution, debt, setDebt, day, setDay, weekly, setWeekly, cadence, setCadence, inputs, missing }}
          />
        )}

        {!debtScreen && placement === null && (
          <div className="mt-auto pt-10">
            {step < TOTAL ? (
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
                Salvar plano e começar a jornada
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Choice<T extends string>({ value, options, onChange, label }: { value: T | null; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="mt-6 grid gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={
            "min-h-12 rounded-xl border px-4 text-left transition-colors " +
            (value === o.value ? "border-primary bg-card font-semibold text-primary" : "border-border bg-card hover:bg-muted")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Step(p: any) {
  switch (p.step as number) {
    case 1:
      return (
        <div>
          <h1>
            <label htmlFor="name">Como você quer ser chamado?</label>
          </h1>
          <Input id="name" autoFocus maxLength={60} value={p.name} onChange={(e) => p.setName(e.target.value)} className="mt-6 h-12 text-lg" />
        </div>
      );
    case 2:
      return (
        <div>
          <h1>Por onde você quer começar?</h1>
          <Choice label="Objetivo inicial" value={p.objective} onChange={p.setObjective} options={OBJECTIVES} />
        </div>
      );
    case 3:
      return (
        <div>
          <h1>Em que ano você nasceu?</h1>
          <div className="mt-6">
            <NumberField label="Ano de nascimento" value={p.birthYear} onChange={p.setBirthYear} min={1930} max={2015} step={1} />
          </div>
          {p.age != null && p.birthYear >= 1930 && p.birthYear <= 2015 && <p className="mt-3 text-muted-foreground">Você tem {p.age} anos.</p>}
        </div>
      );
    case 4:
      return (
        <div>
          <h1>Como você trabalha hoje?</h1>
          <Choice label="Tipo de trabalho" value={p.work} onChange={p.setWork} options={WORK_TYPES.map((w) => ({ value: w.value, label: w.label }))} />
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
            onValueChange={(v) => p.setRetire(v[0])}
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
    case 8:
      return (
        <div>
          <h1>Hoje você tem contas ou dívidas em atraso?</h1>
          <Choice
            label="Dívidas em atraso"
            value={p.debt}
            onChange={p.setDebt}
            options={[
              { value: "sim", label: "Sim" },
              { value: "nao", label: "Não" },
              { value: "prefiro_nao", label: "Prefiro não dizer" },
            ]}
          />
        </div>
      );
    case 9:
      return (
        <div>
          <h1>Em que dia do mês seu dinheiro costuma entrar?</h1>
          <div className="mt-6">
            <NumberField label="Dia do mês (1 a 28)" value={p.day} onChange={p.setDay} min={1} max={28} step={1} hint="Nesse dia, lembramos você de registrar o aporte." />
          </div>
          <label className="mt-6 flex min-h-12 items-center justify-between gap-4 rounded-xl bg-card shadow-card px-4">
            <span>Lembrete semanal da missão</span>
            <Switch checked={p.weekly} onCheckedChange={p.setWeekly} />
          </label>
          <h2 className="mt-8 text-base font-semibold">De quanto em quanto tempo quer revisar o plano?</h2>
          <Choice label="Frequência de revisão" value={p.cadence} onChange={p.setCadence} options={CADENCES} />
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
