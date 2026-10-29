import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { BudgetTab } from "@/components/budget/BudgetTab";
import { SimpleBudget } from "@/components/budget/SimpleBudget";
import { Segmented } from "@/components/forms";
import { AreaTabs } from "@/components/nav/areas";
import { budgetModeOf, demo, useDemo } from "@/lib/data/demo-store";
import { CardBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/_authenticated/orcamento")({
  head: () => pageHead("Orçamento", "O orçamento do mês: limites de gasto por categoria ou envelopes, com a aposentadoria como prioridade.", "O orçamento do mês, simples ou por envelopes."),
  component: Budget,
});

function Budget() {
  const s = useDemo();
  const mode = budgetModeOf(s);
  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-6 lg:max-w-6xl lg:px-8 lg:pb-12 lg:pt-8">
      <AreaTabs />
      <h1>Orçamento</h1>
      <div className="mt-4 max-w-sm">
        <Segmented
          label="Tipo de orçamento"
          value={mode}
          onChange={(budgetMode) => demo.updateProfile({ budgetMode })}
          options={[
            { value: "simples", label: "Simples" },
            { value: "envelopes", label: "Envelopes" },
          ]}
        />
      </div>
      <CardBoundary resetKey={mode}>{mode === "simples" ? <SimpleBudget s={s} /> : <BudgetTab s={s} />}</CardBoundary>
    </main>
  );
}
