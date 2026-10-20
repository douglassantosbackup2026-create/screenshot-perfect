import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { NumberField, LegalNote } from "@/components/forms";
import { simulate, validateInputs, type PlanInputs, type ScenarioResult } from "@/lib/calc/retirement";
import { formatAge, formatMonthly, formatPercent, formatWealth } from "@/lib/calc/format";
import { DEFAULT_ASSUMPTIONS, setCalcPrefill } from "@/lib/data/demo-store";
import { useSession } from "@/lib/data/session";
import { track } from "@/lib/analytics";
import { INSS_HELP, SIMULATION_FOOTER } from "@/lib/labels";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/calculadora")({
  head: () => ({
    meta: [
      { title: "Calculadora — quanto falta para me aposentar sem o INSS" },
      {
        name: "description",
        content: "Calcule, sem login, quanto guardar por mês para se aposentar sem depender do INSS. Valores em reais de hoje e premissas à vista.",
      },
      { property: "og:title", content: "Calculadora — Previdência Intelligence" },
      { property: "og:description", content: "Quanto falta para me aposentar sem o INSS? Faça a conta em um minuto." },
    ],
  }),
  component: Calculator,
});

function Calculator() {
  const navigate = useNavigate();
  const { session } = useSession();
  const [age, setAge] = useState<number | null>(30);
  const [retire, setRetire] = useState<number | null>(60);
  const [income, setIncome] = useState<number | null>(8000);
  const [wealth, setWealth] = useState<number | null>(null);
  const [monthly, setMonthly] = useState<number | null>(null);
  const [inss, setInss] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const calc = useMemo(() => {
    if (age == null || retire == null || income == null) return { errors: ["Preencha idade, idade para se aposentar e renda."] };
    const i: PlanInputs = {
      ...DEFAULT_ASSUMPTIONS,
      returns: { ...DEFAULT_ASSUMPTIONS.returns },
      currentAge: age,
      retirementAge: retire,
      initialWealth: wealth ?? 0,
      monthlyContribution: monthly ?? 0,
      desiredMonthlyIncome: income,
      inssEstimate: inss && inss > 0 ? inss : null,
    };
    const errors = validateInputs(i);
    if (errors.length) return { errors };
    return { errors: [] as string[], i, sem: simulate(i, "central", false), com: i.inssEstimate ? simulate(i, "central", true) : null };
  }, [age, retire, income, wealth, monthly, inss]);

  // Leva tudo o que foi digitado para o onboarding, que abre preenchido depois de criar a conta.
  function start() {
    track("calc_done", { withWealth: wealth != null, withInss: !!inss });
    setCalcPrefill(
      age && retire && income
        ? { currentAge: age, retirementAge: retire, desiredIncome: income, initialWealth: wealth, monthlyContribution: monthly, inssEstimate: inss && inss > 0 ? inss : null }
        : null,
    );
    navigate({ to: session ? "/hoje" : "/cadastro" });
  }

  async function sendLead(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return;
    setSending(true);
    const { error } = await supabase.from("leads").insert({ email: email.trim(), consent_marketing: true, source: "calculadora" });
    setSending(false);
    if (error) {
      toast.error("Não foi possível salvar o e-mail. Confira o endereço e tente de novo.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-16 pt-8">
      <Link to="/" className="text-sm font-semibold text-primary">
        Previdência Intelligence
      </Link>
      <h1 className="mt-6">Quanto falta para me aposentar sem o INSS</h1>
      <p className="mt-3 text-muted-foreground">Sem login. Nada do que você digita é gravado.</p>

      <section className="mt-6 space-y-4 rounded-2xl bg-card shadow-card p-5" aria-label="Seus dados">
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Idade atual" value={age} onChange={setAge} suffix="anos" />
          <NumberField label="Aposentar aos" value={retire} onChange={setRetire} suffix="anos" />
        </div>
        <NumberField label="Renda mensal desejada, em valores de hoje" value={income} onChange={setIncome} prefix="R$" step={100} />
        <NumberField label="Quanto já tem guardado" value={wealth} onChange={setWealth} prefix="R$" optional />
        <NumberField label="Quanto guarda por mês" value={monthly} onChange={setMonthly} prefix="R$" optional />
      </section>

      <section className="mt-8" aria-live="polite" aria-label="Resultado">
        {calc.errors.length ? (
          <p className="text-sm text-destructive">{calc.errors[0]}</p>
        ) : (
          calc.sem && (
            <>
              <h2>Cenário central, sem INSS</h2>
              <Result r={calc.sem} monthly={monthly} horizon={DEFAULT_ASSUMPTIONS.horizonAge} />
              <Assumptions />
            </>
          )
        )}
      </section>

      <section className="mt-10 rounded-2xl bg-card shadow-card p-5">
        <h2 className="text-lg">E se o INSS pagar algo?</h2>
        <div className="mt-4">
          <NumberField label="Estimativa do Meu INSS por mês" value={inss} onChange={setInss} prefix="R$" optional hint={INSS_HELP} />
        </div>
        {calc.sem && calc.com && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Compare title="Sem INSS" r={calc.sem} />
            <Compare title="Com sua estimativa" r={calc.com} />
          </div>
        )}
      </section>

      <Button className="mt-8 w-full" onClick={start}>
        Começar minha jornada
      </Button>

      <section className="mt-10">
        <h2 className="text-lg">Quero receber meu resultado por e-mail</h2>
        {sent ? (
          <p className="mt-3 text-muted-foreground">E-mail salvo. Você pode cancelar quando quiser.</p>
        ) : (
          <form onSubmit={sendLead} className="mt-3 space-y-3">
            <label htmlFor="lead-email" className="sr-only">
              Seu e-mail
            </label>
            <Input
              id="lead-email"
              type="email"
              required
              placeholder="voce@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
            />
            <label className="flex items-start gap-3 text-sm">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
              Aceito receber e-mails do Previdência Intelligence. Só o e-mail é guardado, sem os valores da simulação.
            </label>
            <Button type="submit" variant="outline" className="w-full" disabled={!consent || sending}>
              {sending ? "Salvando…" : "Receber por e-mail"}
            </Button>
          </form>
        )}
      </section>

      <footer className="mt-10 border-t border-border pt-6">
        <LegalNote>{SIMULATION_FOOTER}</LegalNote>
      </footer>
    </main>
  );
}

function Result({ r, monthly, horizon }: { r: ScenarioResult; monthly: number | null; horizon: number }) {
  return (
    <dl className="mt-4 space-y-4">
      <div>
        <dt className="text-sm text-muted-foreground">Aporte necessário</dt>
        <dd className="money font-display text-3xl font-semibold text-primary">cerca de {formatMonthly(r.requiredMonthlyContribution)}/mês</dd>
      </div>
      <div>
        <dt className="text-sm text-muted-foreground">Patrimônio-alvo na aposentadoria</dt>
        <dd className="money text-xl font-semibold">cerca de {formatWealth(r.targetWealth)}</dd>
      </div>
      {monthly != null && monthly > 0 && (
        <div>
          <dt className="text-sm text-muted-foreground">Com o que você guarda hoje</dt>
          <dd>
            {r.depletionAge == null
              ? `o dinheiro dura até os ${horizon} anos.`
              : `o dinheiro duraria até cerca de ${formatAge(r.depletionAge)}.`}
          </dd>
        </div>
      )}
    </dl>
  );
}

function Compare({ title, r }: { title: string; r: ScenarioResult }) {
  return (
    <div className="rounded-2xl bg-muted p-4">
      <p className="text-sm font-semibold">{title}</p>
      <p className="money mt-2 font-display text-xl font-semibold">{formatMonthly(r.requiredMonthlyContribution)}</p>
      <p className="text-xs text-muted-foreground">por mês</p>
      <p className="money mt-2 text-sm">Alvo: {formatWealth(r.targetWealth)}</p>
    </div>
  );
}

function Assumptions() {
  const a = DEFAULT_ASSUMPTIONS;
  return (
    <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
      Premissas: retorno real de {formatPercent(a.returns.central)} ao ano, dinheiro até os {a.horizonAge} anos, sem custos, sem INSS.
      Valores em reais de hoje.
    </p>
  );
}
