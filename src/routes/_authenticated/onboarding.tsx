import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { NumberField } from "@/components/forms";
import { currentBackend, demo, getState, inputsFromProfile, CALC_PREFILL_KEY, type CalcPrefill, type MissingField } from "@/lib/data/demo-store";
import { track } from "@/lib/analytics";
import { ENGINE_VERSION, simulate, type PlanInputs } from "@/lib/calc/retirement";
import { formatMonthly, formatPercent, formatWealth } from "@/lib/calc/format";
import { spDate } from "@/lib/gamification/rules";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Começar — Previdência Intelligence" },
      { name: "description", content: "Cinco perguntas rápidas e seu plano de aposentadoria fica pronto." },
      { property: "og:title", content: "Começar — Previdência Intelligence" },
      { property: "og:description", content: "Cinco perguntas rápidas e seu plano fica pronto." },
    ],
  }),
  component: Onboarding,
});

/**
 * Etapas do plano: 1 nome, 3 ano de nascimento, 5 idade para se aposentar, 6 renda desejada, 7 patrimônio e aporte,
 * 10 a primeira estimativa. Objetivo, trabalho, dívidas e lembretes ficaram para "Primeiros passos" na Jornada.
 */
type StepId = 1 | 3 | 5 | 6 | 7 | 10;
/** Etapas que aceitam "pular por enquanto"; o dado fica marcado como ausente, nunca inventado. */
const SKIPPABLE: Partial<Record<StepId, MissingField[]>> = { 3: ["idade"], 6: ["renda"], 7: ["patrimonio", "aporte"] };
const MISSING_TEXT: Record<MissingField, string> = {
  idade: "idade (usamos 30 anos provisoriamente)",
  renda: "renda desejada (usamos R$ 5.000 provisoriamente)",
  patrimonio: "patrimônio atual (considerado R$ 0)",
  aporte: "aporte mensal (considerado R$ 0)",
};

function readPrefill(): CalcPrefill | null {
  try {
    const raw = localStorage.getItem(CALC_PREFILL_KEY);
    return raw ? (JSON.parse(raw) as CalcPrefill) : null;
  } catch {
    return null;
  }
}

function Onboarding() {
  const navigate = useNavigate();
  const year = Number(spDate(new Date()).slice(0, 4));
  // O que já veio do cadastro (nome) e da calculadora preenche as etapas, que então são puladas.
  const prefill = useMemo(readPrefill, []);
  const knownName = useMemo(() => getState().profile.displayName.trim(), []);
  const [name, setName] = useState(knownName);
  const [birthYear, setBirthYear] = useState<number | null>(prefill?.currentAge ? year - prefill.currentAge : null);
  const [retire, setRetire] = useState(prefill?.retirementAge ? Math.min(Math.max(prefill.retirementAge, 45), 75) : 60);
  const [income, setIncome] = useState<number | null>(prefill?.desiredIncome ?? null);
  const [wealth, setWealth] = useState<number | null>(prefill?.initialWealth ?? null);
  const [contribution, setContribution] = useState<number | null>(prefill?.monthlyContribution ?? null);
  const inss = prefill?.inssEstimate ?? null;
  const [missing, setMissing] = useState<MissingField[]>([]);

  const flow = useMemo<StepId[]>(() => {
    const f: StepId[] = [];
    if (!knownName) f.push(1);
    if (!prefill?.currentAge) f.push(3);
    if (!prefill?.retirementAge) f.push(5);
    if (!prefill?.desiredIncome) f.push(6);
    if (prefill?.initialWealth == null || prefill?.monthlyContribution == null) f.push(7);
    f.push(10);
    return f;
  }, [knownName, prefill]);
  const [index, setIndex] = useState(0);
  const step = flow[index]!;
  const total = flow.length;

  const age = birthYear ? year - birthYear : null;
  const valid: Record<StepId, boolean> = {
    1: name.trim().length > 0 && name.trim().length <= 60,
    3: birthYear != null && birthYear >= 1930 && birthYear <= 2015,
    5: retire >= 45 && retire <= 75 && (age == null || retire > age),
    6: income != null && income > 0,
    7: wealth != null && wealth >= 0 && contribution != null && contribution >= 0,
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
    setIndex((i) => Math.min(total - 1, i + 1));
  }
  function next() {
    const fields = SKIPPABLE[step];
    if (fields) setMissing((m) => m.filter((f) => !fields.includes(f)));
    setIndex((i) => Math.min(total - 1, i + 1));
  }
  function back() {
    if (index === 0) {
      navigate({ to: "/" });
      return;
    }
    setIndex((i) => i - 1);
  }
  useEffect(() => track("onboarding_start", { steps: total }), [total]);
  function finish() {
    // No modo demonstração recomeça do zero; com conta, os dados já estão no banco e não podem ser zerados aqui.
    if (currentBackend() === "demo") demo.startFresh();
    demo.updateProfile({
      displayName: name.trim(),
      birthYear: birthYearKnown,
      monthlyReminder: true,
      onboardingCompletedAt: new Date().toISOString(),
      goalRetirementAge: retire,
      goalIncome: incomeKnown,
      missingFields: missing,
    });
    demo.savePlan(inputs, "created");
    localStorage.removeItem(CALC_PREFILL_KEY);
    track("onboarding_done", { prefilled: !!prefill, skipped: missing.length });
    navigate({ to: "/hoje" });
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-28px)] w-full max-w-[480px] flex-col px-5 pb-8 pt-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Voltar">
          <ArrowLeft strokeWidth={1.75} />
        </Button>
        <Progress value={((index + 1) / total) * 100} className="h-1.5 flex-1" aria-label={`Etapa ${index + 1} de ${total}`} />
        <span className="w-10 text-right text-xs text-muted-foreground">
          {index + 1}/{total}
        </span>
      </div>

      <div className="flex flex-1 flex-col pt-10">
        <Step step={step} {...{ name, setName, birthYear, setBirthYear, age, retire, setRetire, income, setIncome, wealth, setWealth, contribution, setContribution, inputs, missing }} />

        <div className="mt-auto pt-10">
          {step !== 10 ? (
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
              Salvar plano e começar
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

type StepProps = {
  step: StepId;
  name: string;
  setName: (v: string) => void;
  birthYear: number | null;
  setBirthYear: (v: number | null) => void;
  age: number | null;
  retire: number;
  setRetire: (v: number) => void;
  income: number | null;
  setIncome: (v: number | null) => void;
  wealth: number | null;
  setWealth: (v: number | null) => void;
  contribution: number | null;
  setContribution: (v: number | null) => void;
  inputs: PlanInputs;
  missing: MissingField[];
};

function Step(p: StepProps) {
  switch (p.step) {
    case 1:
      return (
        <div>
          <h1>
            <label htmlFor="name">Como você quer ser chamado?</label>
          </h1>
          <Input id="name" autoFocus maxLength={60} value={p.name} onChange={(e) => p.setName(e.target.value)} className="mt-6 h-12 text-lg" />
        </div>
      );
    case 3:
      return (
        <div>
          <h1>Em que ano você nasceu?</h1>
          <div className="mt-6">
            <NumberField label="Ano de nascimento" value={p.birthYear} onChange={p.setBirthYear} min={1930} max={2015} step={1} />
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
          <Slider className="mt-8" min={45} max={75} step={1} value={[p.retire]} onValueChange={(v) => p.setRetire(v[0]!)} aria-label="Idade para se aposentar" />
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
        <li>{inputs.inssEstimate ? `INSS estimado em ${formatMonthly(inputs.inssEstimate)} por mês fica de fora deste número` : "Sem INSS: o plano considera só o seu patrimônio"}</li>
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
