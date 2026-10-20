// "Primeiros passos" na Jornada: o que saiu do onboarding para o plano ficar pronto em menos de um minuto.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NumberField } from "@/components/forms";
import { demo, type DemoState, type Objective, type ReviewCadence, type WorkType } from "@/lib/data/demo-store";
import { WORK_TYPES } from "@/lib/labels";
import { cn } from "@/lib/utils";

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

/** Os passos e se já foram feitos, a partir dos próprios dados. */
export function firstSteps(s: DemoState) {
  return [
    // A pergunta das dívidas pode ficar sem resposta ("prefiro não dizer"): não trava o passo.
    { key: "perfil", label: "Completar seu perfil", done: !!s.profile.objective && !!s.profile.workType },
    { key: "conta", label: "Cadastrar sua conta corrente", done: s.accounts.length > 0 },
    { key: "extrato", label: "Importar o primeiro extrato", done: s.transactions.some((t) => t.source === "importado") },
    { key: "orcamento", label: "Planejar o primeiro orçamento", done: Object.values(s.budget.assigned).some((m) => Object.values(m).some((v) => v > 0)) },
  ] as const;
}

export function FirstStepsCard({ s }: { s: DemoState }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const steps = firstSteps(s);
  const done = steps.filter((x) => x.done).length;
  if (done === steps.length) return null;
  const action = (key: (typeof steps)[number]["key"]) =>
    key === "perfil" ? (
      <Button size="sm" variant="outline" onClick={() => setProfileOpen(true)}>
        Completar
      </Button>
    ) : (
      <Button asChild size="sm" variant="outline">
        <Link to={key === "conta" ? "/contas" : key === "extrato" ? "/diario" : "/orcamento"}>{key === "extrato" ? "Importar" : "Abrir"}</Link>
      </Button>
    );
  return (
    <section className="rounded-2xl bg-card p-5 shadow-card" aria-label="Primeiros passos">
      <p className="eyebrow">Primeiros passos</p>
      <h2 className="mt-1 text-lg">
        {done} de {steps.length} feitos
      </h2>
      <Progress value={(done / steps.length) * 100} className="mt-3 h-2" aria-label={`${done} de ${steps.length} passos`} />
      <ul className="mt-3 divide-y divide-border">
        {steps.map((x) => (
          <li key={x.key} className="flex min-h-12 items-center justify-between gap-3 py-2">
            <span className={cn("flex items-center gap-2 text-sm", x.done && "text-muted-foreground line-through")}>
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", x.done ? "bg-primary text-primary-foreground" : "bg-muted")} aria-hidden>
                {x.done && <Check size={12} strokeWidth={3} />}
              </span>
              {x.label}
            </span>
            {!x.done && action(x.key)}
          </li>
        ))}
      </ul>
      <ProfileSheet s={s} open={profileOpen} onClose={() => setProfileOpen(false)} />
    </section>
  );
}

function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T | null; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <div role="radiogroup" aria-label={label} className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn("min-h-10 rounded-full border px-4 text-left text-sm", value === o.value ? "border-primary font-semibold text-primary" : "border-border")}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type Debt = "sim" | "nao" | "prefiro_nao";

function ProfileSheet({ s, open, onClose }: { s: DemoState; open: boolean; onClose: () => void }) {
  const [objective, setObjective] = useState<Objective | null>(null);
  const [work, setWork] = useState<WorkType | null>(null);
  const [debt, setDebt] = useState<Debt | null>(null);
  const [day, setDay] = useState<number | null>(5);
  const [weekly, setWeekly] = useState(true);
  const [cadence, setCadence] = useState<ReviewCadence>("trimestral");
  useEffect(() => {
    if (!open) return;
    setObjective(s.profile.objective);
    setWork(s.profile.workType);
    setDebt(s.profile.hasOverdueDebt === true ? "sim" : s.profile.hasOverdueDebt === false ? "nao" : null);
    setDay(s.profile.reminderDay);
    setWeekly(s.profile.weeklyReminder);
    setCadence(s.profile.reviewCadence);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;

  function save() {
    if (day == null || day < 1 || day > 28) {
      toast.error("Escolha um dia entre 1 e 28.");
      return;
    }
    demo.updateProfile({
      objective,
      workType: work,
      // "Prefiro não dizer" fica em branco: nunca afirma que não há dívidas.
      hasOverdueDebt: debt === "sim" ? true : debt === "nao" ? false : null,
      reminderDay: day,
      weeklyReminder: weekly,
      reviewCadence: cadence,
    });
    toast.success("Perfil atualizado.");
    onClose();
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-[480px] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">Seu perfil</SheetTitle>
          <SheetDescription>Ajuda a jornada e os lembretes a fazerem sentido para você. Leva um minuto.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-5 pb-4">
          <Chips label="Por onde você quer começar?" value={objective} options={OBJECTIVES} onChange={setObjective} />
          <Chips label="Como você trabalha hoje?" value={work} options={WORK_TYPES.map((w) => ({ value: w.value, label: w.label }))} onChange={setWork} />
          <Chips
            label="Hoje você tem contas ou dívidas em atraso?"
            value={debt}
            onChange={setDebt}
            options={[
              { value: "sim", label: "Sim" },
              { value: "nao", label: "Não" },
              { value: "prefiro_nao", label: "Prefiro não dizer" },
            ]}
          />
          {debt === "sim" && (
            <div className="rounded-2xl bg-muted p-4 text-sm leading-6">
              <p className="font-semibold">Antes de tudo, vale cuidar disso</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Liste todas as dívidas, com valor e juros de cada uma.</li>
                <li>Priorize quitar as de juros mais altos, como cartão e cheque especial.</li>
                <li>Renegocie direto com o credor ou em canais oficiais, como o Desenrola e o consumidor.gov.br.</li>
              </ol>
              <p className="mt-2 text-muted-foreground">Desconfie de quem cobra para "limpar seu nome".</p>
            </div>
          )}
          <NumberField label="Em que dia do mês seu dinheiro costuma entrar?" value={day} onChange={setDay} min={1} max={28} step={1} hint="Nesse dia, lembramos você do fechamento do mês." />
          <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-muted px-4">
            <span className="text-sm">Lembrete semanal da missão</span>
            <Switch checked={weekly} onCheckedChange={setWeekly} />
          </label>
          <Chips label="De quanto em quanto tempo quer revisar o plano?" value={cadence} options={CADENCES} onChange={setCadence} />
          <Button className="w-full" onClick={save}>
            Salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
