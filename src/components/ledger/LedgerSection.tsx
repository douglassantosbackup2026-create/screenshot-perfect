// Lançamentos do mês no Diário: resumo, gastos por categoria, próximas recorrências e a lista por dia.
// Só exibe; as contas vêm de src/lib/calc e src/lib/data/selectors.
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeftRight, ChevronLeft, ChevronRight, FileUp, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HIDDEN } from "@/components/dashboard";
import { ImportSheet } from "@/components/ledger/ImportSheet";
import { RecurringSheet } from "@/components/ledger/RecurringSheet";
import { TransactionSheet, type TxEditing } from "@/components/ledger/TransactionSheet";
import { formatMoney } from "@/lib/calc/format";
import type { DemoState } from "@/lib/data/demo-store";
import { ledgerMonth, upcomingRecurring } from "@/lib/data/selectors";
import { addMonths, monthOf, spDate } from "@/lib/gamification/rules";
import { formatDate, monthYear } from "@/lib/labels";
import { cn } from "@/lib/utils";

const ALL = "todas";
const dayLabel = (d: string) => formatDate(`${d}T12:00:00Z`);

export function LedgerSection({
  s,
  showValues,
  editing,
  setEditing,
}: {
  s: DemoState;
  showValues: boolean;
  editing: TxEditing;
  setEditing: (e: TxEditing) => void;
}) {
  const current = monthOf(spDate(new Date()));
  const [month, setMonth] = useState(current);
  const [accountId, setAccountId] = useState<string>(ALL);
  const [importOpen, setImportOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const money = (cents: number) => (showValues ? formatMoney(cents) : HIDDEN);
  const m = useMemo(() => ledgerMonth(s, month, accountId === ALL ? null : accountId), [s, month, accountId]);
  const upcoming = useMemo(() => upcomingRecurring(s).slice(0, 4), [s]);
  const topSpending = m.byCategory.slice(0, 5);

  return (
    <section className="mt-10" aria-label="Lançamentos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">Lançamentos</h2>
        <Link to="/contas" className="text-sm font-semibold text-primary hover:underline">
          Contas e categorias
        </Link>
      </div>

      {s.accounts.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-card p-6 text-center shadow-card">
          <p className="font-semibold">Nenhuma conta cadastrada</p>
          <p className="mt-1 text-sm text-muted-foreground">Cadastre sua conta corrente e seu cartão para lançar gastos, receitas e importar extratos.</p>
          <Button asChild className="mt-4">
            <Link to="/contas">Cadastrar conta</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button onClick={() => setEditing({ tx: null })}>Lançar</Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp size={16} strokeWidth={1.75} aria-hidden /> Importar
            </Button>
            <Button variant="outline" onClick={() => setRecurringOpen(true)}>
              <Repeat size={16} strokeWidth={1.75} aria-hidden /> Recorrentes
            </Button>
          </div>

          <div className="mt-6 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => setMonth(addMonths(month, -1))}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card hover:text-primary"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <p className="font-semibold">{monthYear(month)}</p>
            <button
              type="button"
              aria-label="Próximo mês"
              disabled={month >= current}
              onClick={() => setMonth(addMonths(month, 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card hover:text-primary disabled:opacity-40"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="mt-3 h-11 rounded-xl bg-card" aria-label="Filtrar por conta">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as contas</SelectItem>
              {s.accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <dl className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-card p-3 shadow-card">
              <dt className="text-xs text-muted-foreground">Entradas</dt>
              <dd className="money font-display text-lg font-bold text-primary">{money(m.summary.income)}</dd>
            </div>
            <div className="rounded-2xl bg-card p-3 shadow-card">
              <dt className="text-xs text-muted-foreground">Saídas</dt>
              <dd className="money font-display text-lg font-bold">{money(m.summary.expense)}</dd>
            </div>
            <div className="rounded-2xl bg-card p-3 shadow-card">
              <dt className="text-xs text-muted-foreground">Sobrou</dt>
              <dd className={cn("money font-display text-lg font-bold", m.summary.net < 0 && "text-destructive")}>{money(m.summary.net)}</dd>
            </div>
          </dl>
          {m.uncategorized > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              {m.uncategorized} {m.uncategorized === 1 ? "lançamento sem categoria" : "lançamentos sem categoria"} neste mês.
            </p>
          )}

          {topSpending.length > 0 && (
            <div className="mt-4 rounded-2xl bg-card p-5 shadow-card">
              <h3 className="text-base">Para onde foi o dinheiro</h3>
              <ul className="mt-3 space-y-3">
                {topSpending.map((c) => (
                  <li key={c.categoryId ?? "none"}>
                    <div className="flex justify-between gap-4 text-sm">
                      <span>{c.name}</span>
                      <span className="money text-muted-foreground">{money(c.amount)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden>
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(c.share * 100, 2)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {upcoming.length > 0 && month === current && (
            <div className="mt-4 rounded-2xl bg-card p-5 shadow-card">
              <h3 className="text-base">Próximos 30 dias</h3>
              <ul className="mt-2 divide-y divide-border text-sm">
                {upcoming.map((u) => (
                  <li key={u.rule.id} className="flex items-center justify-between gap-4 py-2">
                    <span>
                      <span className="block font-semibold">{u.rule.payee}</span>
                      <span className="block text-xs text-muted-foreground">
                        {dayLabel(u.date)} · {u.accountName}
                      </span>
                    </span>
                    <span className={cn("money shrink-0 whitespace-nowrap", u.rule.amount > 0 && "text-primary")}>{money(u.rule.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 space-y-4">
            {m.days.length === 0 && <p className="rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">Nenhum lançamento neste mês.</p>}
            {m.days.map((d) => (
              <div key={d.date} className="rounded-2xl bg-card p-4 shadow-card">
                <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                  <span>{dayLabel(d.date)}</span>
                  {d.net !== 0 && <span className="money">{money(d.net)}</span>}
                </div>
                <ul className="mt-2 divide-y divide-border">
                  {d.items.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setEditing({ tx: t })}
                        className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-2.5 text-left hover:bg-muted"
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 truncate font-semibold">
                            {t.transferId && <ArrowLeftRight size={14} className="shrink-0 text-muted-foreground" aria-label="Transferência" />}
                            {t.recurringId && <Repeat size={14} className="shrink-0 text-muted-foreground" aria-label="Recorrente" />}
                            <span className="truncate">{t.payee}</span>
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {t.transferId ? "Transferência" : (t.categoryName ?? "Sem categoria")} · {t.accountName}
                            {t.contributionId ? " · aporte do mês" : ""}
                          </span>
                        </span>
                        <span className={cn("money shrink-0 whitespace-nowrap text-sm", t.amount > 0 && "text-primary")}>{money(t.amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}

      <TransactionSheet s={s} editing={editing} onClose={() => setEditing(null)} />
      <ImportSheet s={s} open={importOpen} onClose={() => setImportOpen(false)} />
      <RecurringSheet s={s} open={recurringOpen} onClose={() => setRecurringOpen(false)} />
    </section>
  );
}
