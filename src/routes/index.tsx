import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { NumberField, LegalNote } from "@/components/forms";
import { simulate, validateInputs, type PlanInputs } from "@/lib/calc/retirement";
import { formatMonthly } from "@/lib/calc/format";
import { DEFAULT_ASSUMPTIONS } from "@/lib/data/demo-store";
import { startOnboarding } from "@/lib/data/start-onboarding";
import { supabase } from "@/integrations/supabase/client";
import { SIMULATION_FOOTER } from "@/lib/labels";
import { JOURNEY_ENABLED } from "@/lib/features";
import { ThreeInOne, Problem, HowItWorks, ProductPreview, Curriculum, WhatWeDont, Pricing, Faq } from "@/components/sales/sections";
import { APP_NAME, APP_TAGLINE } from "@/lib/seo";
import { openConsentPreferences, track } from "@/lib/analytics/analytics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — orçamento, patrimônio e aposentadoria num app só` },
      {
        name: "description",
        content:
          JOURNEY_ENABLED
            ? "Orçamento, patrimônio e aposentadoria num app só, com uma jornada de lições curtas. Controle o mês, acompanhe o que você tem e saiba quanto falta para se aposentar."
            : "Orçamento, patrimônio e aposentadoria num app só. Controle os gastos do mês, acompanhe o que você tem e saiba quanto falta para se aposentar sem depender do INSS.",
      },
      { property: "og:title", content: APP_NAME },
      { property: "og:description", content: APP_TAGLINE },
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

  /** A única ação de começar da página: todos os botões levam ao onboarding pelo mesmo caminho. */
  function start() {
    const prefill = touched && age && retire && income ? { currentAge: age, retirementAge: retire, desiredIncome: income } : null;
    void startOnboarding(prefill, (target) => navigate(target));
  }

  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    track("landing_view");
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[480px] items-center justify-between px-5 py-2">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
            {APP_NAME}
          </span>
          <Link to={signedIn ? "/hoje" : "/entrar"} className="min-h-11 px-2 py-2.5 text-sm font-semibold text-primary">
            {signedIn ? "Abrir o app" : "Entrar"}
          </Link>
        </div>
      </header>
    <main className="mx-auto w-full max-w-[480px] px-5 pb-16 pt-10">

      <p className="eyebrow">Orçamento, patrimônio e aposentadoria</p>
      <h1 className="mt-3 text-[34px] leading-[40px]">
        Seu dinheiro de hoje e o seu futuro, <span className="text-primary">num app só.</span>
      </h1>
      <p className="mt-4 text-lg text-muted-foreground">
        {JOURNEY_ENABLED
          ? "Uma jornada em 4 unidades, de 2 a 5 minutos por lição. Sem vender nada para você: R$ 39,90 por mês, cancele quando quiser."
          : "Controle os gastos do mês, acompanhe seu patrimônio e saiba quanto falta para se aposentar. Sem vender nada para você: R$ 39,90 por mês, cancele quando quiser."}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button onClick={start}>{signedIn ? "Abrir o app" : `Assinar o ${APP_NAME}`}</Button>
      </div>

      <section aria-label="Calculadora rápida" className="mt-6 rounded-2xl bg-card shadow-card p-5">
        <h2 className="mb-4 text-lg">Quanto falta para você se aposentar?</h2>
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
          {signedIn ? "Abrir o app" : "Montar meu plano"}
        </Button>
        <Link to="/calculadora" className="mt-3 block text-center text-sm font-semibold text-primary">
          Ver a conta completa
        </Link>
      </section>

      <ThreeInOne />
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
          {signedIn ? "Abrir o app" : `Assinar o ${APP_NAME}`}
        </Button>
      </section>

      <footer className="mt-16 space-y-3 border-t border-border pt-6">
        <LegalNote>{SIMULATION_FOOTER}</LegalNote>
        <LegalNote>
          <Link to="/sobre" className="underline">
            Sobre o app
          </Link>
          {" · "}
          <Link to="/privacidade" className="underline">
            Privacidade
          </Link>
          {" · "}
          <button type="button" className="underline" onClick={openConsentPreferences}>
            Preferências de privacidade
          </button>
        </LegalNote>
      </footer>
    </main>
    </>
  );
}
