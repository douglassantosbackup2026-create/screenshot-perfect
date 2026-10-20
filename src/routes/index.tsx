import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { NumberField, LegalNote } from "@/components/forms";
import { simulate, validateInputs, type PlanInputs } from "@/lib/calc/retirement";
import { formatMonthly } from "@/lib/calc/format";
import { demo, DEFAULT_ASSUMPTIONS, setCalcPrefill } from "@/lib/data/demo-store";
import { isDemoMode, setDemoMode, useSession } from "@/lib/data/session";
import { SIMULATION_FOOTER } from "@/lib/labels";
import { Problem, HowItWorks, ProductPreview, Curriculum, WhatWeDont, Pricing, Faq } from "@/components/sales/sections";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Previdência Intelligence — aposentadoria sem depender do INSS" },
      {
        name: "description",
        content:
          "Quanto falta para você se aposentar sem depender do INSS? Faça a conta, monte seu plano numa jornada de lições curtas e acompanhe sua evolução todo mês.",
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
  // Só leva os números para o onboarding se a pessoa mexeu neles; os valores de exemplo não são dela.
  const [touched, setTouched] = useState(false);
  const edit = (set: (v: number | null) => void) => (v: number | null) => {
    setTouched(true);
    set(v);
  };

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

  /**
   * A única ação de começar da página: cria a conta (os números digitados vão junto para o onboarding).
   * Quem já está logado vai direto para o app.
   */
  function start() {
    if (session) return void navigate({ to: "/hoje" });
    setCalcPrefill(touched && age && retire && income ? { currentAge: age, retirementAge: retire, desiredIncome: income } : null);
    navigate({ to: "/cadastro" });
  }

  /** Exemplo sem conta: modo demonstração, com os dados da Ana, só neste aparelho. */
  function seeExample() {
    setDemoMode(true);
    demo.reset();
    navigate({ to: "/hoje" });
  }

  const { session } = useSession();
  const [hasProgress, setHasProgress] = useState(false);
  useEffect(() => setHasProgress(isDemoMode()), []);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[480px] items-center justify-between px-5 py-2">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
            Previdência Intelligence
          </span>
          {session || hasProgress ? (
            <Link to="/hoje" className="min-h-11 px-2 py-2.5 text-sm font-semibold text-primary">
              Abrir o app
            </Link>
          ) : (
            <Link to="/entrar" className="min-h-11 px-2 py-2.5 text-sm font-semibold text-primary">
              Entrar
            </Link>
          )}
        </div>
      </header>
    <main className="mx-auto w-full max-w-[480px] px-5 pb-16 pt-10">

      <p className="eyebrow">Aposentadoria sem depender do governo</p>
      <h1 className="mt-3 text-[34px] leading-[40px]">
        Quanto falta para você se aposentar <span className="text-primary">sem depender do INSS?</span>
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">Uma jornada em 4 unidades, de 2 a 5 minutos por lição. Grátis e sem vender nada para você.</p>
      <div className="mt-6 flex flex-col gap-2">
        <Button onClick={start}>Começar grátis</Button>
        <Button variant="ghost" onClick={seeExample}>
          Ver um exemplo
        </Button>
      </div>

      <section aria-label="Calculadora rápida" className="mt-6 rounded-2xl bg-card shadow-card p-5">
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Sua idade" value={age} onChange={edit(setAge)} suffix="anos" min={16} max={90} />
          <NumberField label="Aposentar aos" value={retire} onChange={edit(setRetire)} suffix="anos" min={30} max={90} />
        </div>
        <div className="mt-4">
          <NumberField label="Renda por mês, em valores de hoje" value={income} onChange={edit(setIncome)} prefix="R$" min={0} step={100} />
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
          Começar minha jornada
        </Button>
        <Link to="/calculadora" className="mt-3 block text-center text-sm font-semibold text-primary">
          Ver a conta completa
        </Link>
      </section>

      <Problem />
      <HowItWorks />
      <ProductPreview />
      <Curriculum />
      <WhatWeDont />
      <Pricing onStart={start} />
      <Faq />

      <section className="mt-16 rounded-2xl bg-card shadow-card p-6 text-center">
        <h2>Comece hoje. Leva 5 minutos.</h2>
        <Button className="mt-5 w-full" onClick={start}>
          Começar grátis
        </Button>
      </section>

      <footer className="mt-16 space-y-3 border-t border-border pt-6">
        <LegalNote>{SIMULATION_FOOTER}</LegalNote>
        <LegalNote>
          <Link to="/sobre" className="underline">
            Sobre o app
          </Link>
        </LegalNote>
      </footer>
    </main>
    </>
  );
}
