// Orçamento simples: quanto entrou e saiu no mês, os limites de gasto e os gastos por categoria.
// Só exibe; as contas vêm de src/lib/calc por src/lib/data/selectors.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { Progress } from "@/components/ui/progress";
import { LimitsSheet } from "@/components/ledger/LimitsSheet";
import { formatPercent } from "@/lib/calc/format";
import type { DemoState } from "@/lib/data/demo-store";
import { ledgerMonth, limitsView } from "@/lib/data/selectors";
import { monthOf, spDate } from "@/lib/gamification/rules";
import { monthYear } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { useMoney } from "@/hooks/use-show-values";

export function SimpleBudget({ s }: { s: DemoState }) {
  const [limitsOpen, setLimitsOpen] = useState(false);
  const month = monthOf(spDate(new Date()));
  const m = ledgerMonth(s, month);
  const limits = limitsView(s);
  const money = useMoney();

  if (s.accounts.length === 0) {
    return (
      <EmptyState
        className="mt-6"
        title="Cadastre uma conta para começar"
        action={
          <Button asChild>
            <Link to="/contas">Cadastrar conta</Link>
          </Button>
        }
      >
        Com a conta corrente e o cartão, o orçamento mostra para onde vai o seu dinheiro.
      </EmptyState>
    );
  }

  return (
    <>
      <section className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-card p-5 shadow-card" aria-label={`Resumo de ${monthYear(month)}`}>
        {[
          { label: "Entrou", value: m.summary.income },
          { label: "Saiu", value: m.summary.expense },
          { label: "Sobrou", value: m.summary.net },
        ].map((x) => (
          <div key={x.label}>
            <p className="text-xs text-muted-foreground">{x.label}</p>
            <p className={cn("money font-display text-xl font-semibold", x.label === "Sobrou" && x.value < 0 && "text-destructive")}>{money(x.value)}</p>
          </div>
        ))}
      </section>

      <section className="mt-4 rounded-2xl bg-card p-5 shadow-card" aria-label="Limites de gasto">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg">Limites</h2>
          <Button size="sm" variant="outline" onClick={() => setLimitsOpen(true)}>
            {limits.length ? "Ajustar" : "Criar limite"}
          </Button>
        </div>
        {limits.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Defina quanto quer gastar por semana ou por mês, no total ou numa categoria. Avisamos quando chegar perto.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {limits.map((l) => (
              <li key={l.id}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="font-semibold">{l.name}</span>
                  <span className="money text-muted-foreground">
                    {money(l.spent)} de {money(l.limit)} {l.per}
                  </span>
                </div>
                <Progress
                  value={Math.min(l.pct, 1) * 100}
                  className={cn("mt-1.5 h-2", l.pct >= 1 && "[&>div]:bg-destructive")}
                  aria-label={`${l.name}: ${formatPercent(l.pct)} do limite`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-card p-5 shadow-card" aria-label="Gastos por categoria">
        <h2 className="text-lg">Para onde foi o dinheiro</h2>
        {m.byCategory.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nenhum gasto em {monthYear(month).toLowerCase()} ainda.{" "}
            <Link to="/diario" search={{ lancar: true }} className="font-semibold text-primary hover:underline">
              Lançar um gasto
            </Link>
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {m.byCategory.map((c) => (
              <li key={c.categoryId ?? "sem"} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate">{c.name}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${c.share * 100}%` }} />
                </span>
                <span className="money w-24 shrink-0 text-right text-muted-foreground">{money(c.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <LimitsSheet s={s} open={limitsOpen} onClose={() => setLimitsOpen(false)} />
    </>
  );
}
