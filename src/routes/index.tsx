import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { NumberField, LegalNote } from "@/components/forms";
import { simulate, validateInputs, type PlanInputs } from "@/lib/calc/retirement";
import { formatMonthly } from "@/lib/calc/format";
import { DEFAULT_ASSUMPTIONS, CALC_PREFILL_KEY } from "@/lib/data/demo-store";
import { SIMULATION_FOOTER } from "@/lib/labels";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Previdência Intelligence — aposentadoria sem depender do INSS" },
      {
        name: "description",
        content:
          "Quanto falta para você se aposentar sem depender do INSS? Faça a conta, monte seu plano em 21 dias e registre seus aportes todo mês.",
      },
      { property: "og:title", content: "Previdência Intelligence" },
      {
        property: "og:description",
        content: "Um plano de aposentadoria que não depende do governo — e que você consegue seguir.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [age, setAge] = useState<number | null>(30);
  const [retire, setRetire] = useState<number | null>(60);
  const [income, setIncome] = useState<number | null>(8000);

  const result = useMemo(() => {
    if (age == null || retire == null || income == null) return null;
    const i: PlanInputs = {
      ...DEFAULT_ASSUMPTIONS,
      returns: { ...DEFAULT_ASSUMPTIONS.returns },
      currentAge: age,
      retirementAge: retire,
      initialWealth: 0,
      monthlyContribution: 0,
      desiredMonthlyIncome: income,
      inssEstimate: null,
    };
    const errors = validateInputs(i);
    if (errors.length) return { errors };
    return { errors: [], r: simulate(i, "central", false) };
  }, [age, retire, income]);

  function start() {
    if (age && retire && income)
      sessionStorage.setItem(CALC_PREFILL_KEY, JSON.stringify({ currentAge: age, retirementAge: retire, desiredIncome: income }));
    navigate({ to: "/entrar" });
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-16 pt-10">
      <header className="flex items-center justify-between">
        <span className="font-display text-lg font-semibold text-primary">Previdência Intelligence</span>
        <Link to="/entrar" className="min-h-11 px-2 py-2.5 text-sm font-semibold text-primary">
          Entrar
        </Link>
      </header>

      <h1 className="mt-10">Quanto falta para você se aposentar sem depender do INSS?</h1>

      <section aria-label="Calculadora rápida" className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Sua idade" value={age} onChange={setAge} suffix="anos" min={16} max={90} />
          <NumberField label="Aposentar aos" value={retire} onChange={setRetire} suffix="anos" min={30} max={90} />
        </div>
        <div className="mt-4">
          <NumberField label="Renda por mês, em valores de hoje" value={income} onChange={setIncome} prefix="R$" min={0} step={100} />
        </div>
        <div className="mt-6" aria-live="polite">
          {result?.errors.length ? (
            <p className="text-sm text-destructive">{result.errors[0]}</p>
          ) : result?.r ? (
            <p className="text-lg leading-7">
              Para ter <strong className="money">{formatMonthly(income!)}</strong> por mês a partir dos {retire}, sem contar com o
              INSS, você precisaria guardar cerca de{" "}
              <strong className="money font-display text-2xl text-primary">{formatMonthly(result.r.requiredMonthlyContribution)}</strong>{" "}
              por mês.
            </p>
          ) : null}
        </div>
        <Button className="mt-5 w-full" onClick={start}>
          Montar meu plano em 21 dias
        </Button>
        <Link to="/calculadora" className="mt-3 block text-center text-sm font-semibold text-primary">
          Ver a conta completa
        </Link>
      </section>

      <section className="mt-12">
        <h2>Como funciona</h2>
        <ol className="mt-4 space-y-4">
          {[
            "Uma lição de 5 minutos por dia.",
            "No dia 14, seu plano fica pronto.",
            "Todo mês, você registra seu aporte e vê o fio da constância crescer.",
          ].map((t, i) => (
            <li key={t} className="flex gap-4">
              <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-primary">
                {i + 1}
              </span>
              <span className="pt-1.5">{t}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 border-l-2 border-primary pl-4">
        <h2 className="text-lg">O que não fazemos</h2>
        <p className="mt-2 text-muted-foreground">
          Não vendemos investimentos, não pedimos sua senha do banco e não movimentamos seu dinheiro.
        </p>
      </section>

      <footer className="mt-12 space-y-3 border-t border-border pt-6">
        <LegalNote>{SIMULATION_FOOTER}</LegalNote>
        <LegalNote>
          <Link to="/sobre" className="underline">
            Sobre o app
          </Link>
        </LegalNote>
      </footer>
    </main>
  );
}
