import { createFileRoute } from "@tanstack/react-router";
import { BudgetTab } from "@/components/budget/BudgetTab";
import { AreaTabs } from "@/components/nav/areas";
import { PlanGate } from "@/components/PlanGate";
import { useDemo } from "@/lib/data/demo-store";

export const Route = createFileRoute("/_authenticated/orcamento")({
  head: () => ({
    meta: [
      { title: "Orçamento — Previdência Intelligence" },
      { name: "description", content: "O orçamento do mês por envelopes, com a aposentadoria como envelope prioritário." },
      { property: "og:title", content: "Orçamento — Previdência Intelligence" },
      { property: "og:description", content: "O orçamento do mês por envelopes, com a aposentadoria como envelope prioritário." },
    ],
  }),
  component: Budget,
});

function Budget() {
  const s = useDemo();
  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-6 lg:max-w-6xl lg:px-8 lg:pb-12 lg:pt-8">
      <AreaTabs />
      <h1>Orçamento</h1>
      <PlanGate feature="orcamento" hasData={Object.values(s.budget.assigned).some((m) => Object.keys(m).length > 0) || s.budget.templates.length > 0}>
        <BudgetTab s={s} />
      </PlanGate>
    </main>
  );
}
