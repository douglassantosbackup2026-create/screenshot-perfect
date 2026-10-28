import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { Waitlist } from "@/components/sales/sections";
import { useAccess } from "@/components/Upgrade";
import { PLANS, PRICING_NOTE } from "@/content/pricing";
import { FEATURES } from "@/lib/entitlements/matrix";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => pageHead("Planos", "O que é grátis para sempre e o que o plano Inteligência acrescenta."),
  component: Plans,
});

function Plans() {
  const access = useAccess();
  const free = PLANS.find((p) => p.slug === "free")!;
  const paid = PLANS.find((p) => p.slug === "inteligencia")!;
  const pro = PLANS.find((p) => p.slug === "pro")!;
  const paidFeatures = Object.values(FEATURES).filter((f) => f.minTier === "inteligencia");

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-8 lg:max-w-3xl lg:px-8 lg:pb-12">
      <h1>Planos</h1>
      <p className="mt-1 text-muted-foreground">O que você usa hoje continua grátis. O Inteligência mostra se você está no ritmo e ajuda a decidir melhor.</p>

      {access.launchOpen && (
        <p className="mt-6 rounded-2xl bg-primary/15 p-4 text-sm">
          <span className="font-semibold">Lançamento:</span> os recursos do Inteligência estão liberados de graça por enquanto. Quando a cobrança
          começar, avisamos antes, e nada é cobrado sem você assinar.
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl bg-card p-6 shadow-card" aria-label={`Plano ${free.name}`}>
          <p className="font-display text-xl font-semibold">{free.name}</p>
          <p className="money mt-1 text-2xl font-semibold">{free.price}</p>
          <p className="mt-1 text-sm font-semibold text-primary">Grátis para sempre</p>
          <ul className="mt-4 space-y-2 text-sm">
            {free.features.map((f) => (
              <li key={f} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl bg-card p-6 shadow-card ring-2 ring-primary" aria-label={`Plano ${paid.name}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-xl font-semibold">{paid.name}</p>
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">{paid.tag}</span>
          </div>
          <p className="money mt-1 text-2xl font-semibold">
            {paid.price}
            <span className="text-sm font-normal text-muted-foreground">{paid.period}</span>
          </p>
          {paid.annualNote && <p className="text-sm text-muted-foreground">{paid.annualNote}</p>}
          <p className="mt-3 text-sm">Tudo do {free.name}, e mais:</p>
          <ul className="mt-3 space-y-3 text-sm">
            {paidFeatures.map((f) => (
              <li key={f.key} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                <span>
                  <span className="font-semibold">{f.label}</span>
                  <span className="block text-muted-foreground">{f.upsell}</span>
                </span>
              </li>
            ))}
          </ul>
          {paid.waitlistSource && <Waitlist source={paid.waitlistSource} planName={paid.name} />}
        </section>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{pro.name}:</span> em preparação, para quem quer ir mais fundo no acompanhamento.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{PRICING_NOTE}</p>
    </main>
  );
}
