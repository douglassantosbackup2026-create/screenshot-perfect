import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { NumberField } from "@/components/forms";
import { demo, CALC_PREFILL_KEY, type CalcPrefill, type WorkType } from "@/lib/data/demo-store";
import { WORK_TYPES } from "@/lib/labels";
import { spDate } from "@/lib/gamification/rules";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Começar — Previdência Intelligence" },
      { name: "description", content: "Algumas perguntas rápidas para montar seu programa de 21 dias." },
      { property: "og:title", content: "Começar — Previdência Intelligence" },
      { property: "og:description", content: "Algumas perguntas rápidas para montar seu programa de 21 dias." },
    ],
  }),
  component: Onboarding,
});

type Debt = "sim" | "nao" | "prefiro_nao";
const TOTAL = 8;

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [debtScreen, setDebtScreen] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState<number | null>(null);
  const [work, setWork] = useState<WorkType | null>(null);
  const [retire, setRetire] = useState(60);
  const [income, setIncome] = useState<number | null>(null);
  const [debt, setDebt] = useState<Debt | null>(null);
  const [day, setDay] = useState<number | null>(5);
  const [weekly, setWeekly] = useState(true);
  const year = Number(spDate(new Date()).slice(0, 4));

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CALC_PREFILL_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as CalcPrefill;
      if (p.currentAge) setBirthYear(year - p.currentAge);
      if (p.retirementAge >= 45 && p.retirementAge <= 75) setRetire(p.retirementAge);
      if (p.desiredIncome) setIncome(p.desiredIncome);
    } catch {
      /* ignora */
    }
  }, [year]);

  const age = birthYear ? year - birthYear : null;
  const valid: Record<number, boolean> = {
    1: name.trim().length > 0 && name.trim().length <= 60,
    2: birthYear != null && birthYear >= 1930 && birthYear <= 2015,
    3: work != null,
    4: retire >= 45 && retire <= 75 && (age == null || retire > age),
    5: income != null && income > 0,
    6: debt != null,
    7: day != null && day >= 1 && day <= 28,
    8: true,
  };

  function next() {
    if (step === 6 && debt === "sim" && !debtScreen) {
      setDebtScreen(true);
      return;
    }
    setDebtScreen(false);
    setStep((s) => Math.min(TOTAL, s + 1));
  }
  function back() {
    if (debtScreen) return setDebtScreen(false);
    if (step === 1) return navigate({ to: "/entrar" });
    setStep((s) => s - 1);
  }
  function finish() {
    demo.startFresh();
    demo.updateProfile({
      displayName: name.trim(),
      birthYear,
      workType: work,
      hasOverdueDebt: debt === "sim" ? true : debt === "nao" ? false : null,
      reminderDay: day ?? 5,
      monthlyReminder: true,
      weeklyReminder: weekly,
      onboardingCompletedAt: new Date().toISOString(),
      goalRetirementAge: retire,
      goalIncome: income,
    });
    sessionStorage.removeItem(CALC_PREFILL_KEY);
    navigate({ to: "/programa/$dia", params: { dia: "1" } });
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
        {debtScreen ? (
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
              <Button onClick={next}>Continuar para o programa</Button>
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
            {...{ name, setName, birthYear, setBirthYear, age, work, setWork, retire, setRetire, income, setIncome, debt, setDebt, day, setDay, weekly, setWeekly }}
          />
        )}

        {!debtScreen && (
          <div className="mt-auto pt-10">
            {step < TOTAL ? (
              <Button className="w-full" onClick={next} disabled={!valid[step]}>
                Continuar
              </Button>
            ) : (
              <Button className="w-full" onClick={finish}>
                Começar dia 1
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
            "min-h-12 rounded-[10px] border px-4 text-left transition-colors " +
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
          <h1>Em que ano você nasceu?</h1>
          <div className="mt-6">
            <NumberField label="Ano de nascimento" value={p.birthYear} onChange={p.setBirthYear} min={1930} max={2015} step={1} />
          </div>
          {p.age != null && p.birthYear >= 1930 && p.birthYear <= 2015 && <p className="mt-3 text-muted-foreground">Você tem {p.age} anos.</p>}
        </div>
      );
    case 3:
      return (
        <div>
          <h1>Como você trabalha hoje?</h1>
          <Choice label="Tipo de trabalho" value={p.work} onChange={p.setWork} options={WORK_TYPES.map((w) => ({ value: w.value, label: w.label }))} />
        </div>
      );
    case 4:
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
    case 5:
      return (
        <div>
          <h1>Quanto você gostaria de ter por mês, em valores de hoje?</h1>
          <div className="mt-6">
            <NumberField label="Renda mensal desejada" value={p.income} onChange={p.setIncome} prefix="R$" step={100} hint="Um bom ponto de partida é a sua renda atual." />
          </div>
        </div>
      );
    case 6:
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
    case 7:
      return (
        <div>
          <h1>Em que dia do mês seu dinheiro costuma entrar?</h1>
          <div className="mt-6">
            <NumberField label="Dia do mês (1 a 28)" value={p.day} onChange={p.setDay} min={1} max={28} step={1} hint="Nesse dia, lembramos você de registrar o aporte." />
          </div>
          <label className="mt-6 flex min-h-12 items-center justify-between gap-4 rounded-[10px] border border-border bg-card px-4">
            <span>Lembrete semanal da missão</span>
            <Switch checked={p.weekly} onCheckedChange={p.setWeekly} />
          </label>
        </div>
      );
    default:
      return (
        <div>
          <h1>Seu programa de 21 dias começa hoje.</h1>
          <p className="mt-4 text-muted-foreground">Uma lição de 3 a 5 minutos por dia. No dia 14, seu plano fica pronto.</p>
        </div>
      );
  }
}
