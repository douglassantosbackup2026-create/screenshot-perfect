import { useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { Check, FileUp, PartyPopper, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CardBoundary } from "@/components/ErrorBoundary";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { handleResult, runAction, xpToast } from "@/components/feedback";
import { ImportSheet } from "@/components/ledger/ImportSheet";
import { TransactionSheet, type TxEditing } from "@/components/ledger/TransactionSheet";
import { DailyAlertsCard } from "@/components/ledger/DayToDay";
import { LimitsSheet } from "@/components/ledger/LimitsSheet";
import { formatMoney, formatMonthly, formatPercent, formatWealth } from "@/lib/calc/format";
import { budgetModeOf, demo, monthCloseSteps, useDemo, type DemoState, type MonthStepKey } from "@/lib/data/demo-store";
import { assetSnapshot, budgetView, monthCloseShare, uncategorizedGroups } from "@/lib/data/selectors";
import { XP } from "@/lib/gamification/rules";
import { JOURNEY_ENABLED } from "@/lib/features";
import { formatDate, monthName, monthYear } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/fechamento")({
  head: () => pageHead("Fechamento do mês", "Uns 10 minutos por mês: o mês lançado, categorizado, orçado, com o aporte e o patrimônio em dia.", "Uns 10 minutos, uma vez por mês."),
  component: MonthClose,
});

const TITLES: Record<MonthStepKey, string> = {
  lancamentos: "Lançar o mês",
  categorias: "Categorizar o que ficou sem categoria",
  orcamento: "Dar um destino ao dinheiro",
  aporte: "Fazer o aporte do mês",
  patrimonio: "Atualizar o patrimônio",
};

function MonthClose() {
  const s = useDemo();
  const c = monthCloseSteps(s);
  const [importOpen, setImportOpen] = useState(false);
  const [txEditing, setTxEditing] = useState<TxEditing>(null);
  const firstOpen = c.steps.find((x) => !x.done)?.key;

  function close() {
    try {
      const r = demo.closeMonth();
      xpToast(`${monthYear(c.month)} fechado.`, r.xpAwarded);
      handleResult(r);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-6 lg:max-w-3xl lg:px-8 lg:pb-12 lg:pt-8">
      <p className="eyebrow">Fechamento do mês</p>
      <h1 className="mt-1">{monthYear(c.month)}</h1>
      <p className="mt-1 text-muted-foreground">{c.steps.length} passos, uns 10 minutos. Faça na ordem ou como preferir.</p>
      <div className="mt-4 flex items-center gap-3">
        <Progress value={(c.doneCount / c.steps.length) * 100} className="h-2 flex-1" aria-label={`${c.doneCount} de ${c.steps.length} passos`} />
        <span className="text-sm font-semibold">
          {c.doneCount} de {c.steps.length}
        </span>
      </div>

      <ol className="mt-6 space-y-3">
        {c.steps.map((step, i) => (
          <Step key={step.key} n={i + 1} title={TITLES[step.key]} done={step.done} current={step.key === firstOpen}>
            {step.key === "lancamentos" && <LedgerStep s={s} usesLedger={c.usesLedger} onImport={() => setImportOpen(true)} onAdd={() => setTxEditing({ tx: null })} />}
            {step.key === "categorias" && <CategorizeStep s={s} rows={c.uncategorized} usesLedger={c.usesLedger} />}
            {step.key === "orcamento" && <BudgetStep s={s} month={c.month} />}
            {step.key === "aporte" && <ContributionStep s={s} month={c.month} done={step.done} onTransfer={() => setTxEditing({ tx: null })} />}
            {step.key === "patrimonio" && <WealthStep s={s} done={step.done} />}
          </Step>
        ))}
      </ol>

      <CardBoundary><DailyAlertsCard s={s} showValues={!s.profile.hideValues} className="mt-6" title="Antes de fechar, confira os avisos" /></CardBoundary>

      <section className="mt-6">
        {c.closed ? (
          <div className="rounded-3xl bg-primary p-6 text-center text-primary-foreground">
            <PartyPopper size={28} className="mx-auto" aria-hidden />
            <p className="mt-2 text-lg font-semibold">{monthYear(c.month)} está fechado.</p>
            <p className="mt-1 text-sm text-primary-foreground/80">Até o mês que vem. Seu progresso está em Progresso.</p>
            <Button variant="secondary" className="mt-4" onClick={() => void shareClose(s, c.month)}>
              <Share2 size={16} aria-hidden /> Compartilhar conquista
            </Button>
          </div>
        ) : (
          <Button className="w-full" disabled={!c.complete} onClick={close}>
            {c.complete
              ? `Fechar ${monthName(c.month)}${JOURNEY_ENABLED ? ` (+${XP.month_closed} XP)` : ""}`
              : c.steps.length - c.doneCount === 1
                ? "Falta 1 passo para fechar o mês"
                : `Faltam ${c.steps.length - c.doneCount} passos para fechar o mês`}
          </Button>
        )}
      </section>

      <ImportSheet s={s} open={importOpen} onClose={() => setImportOpen(false)} />
      <TransactionSheet s={s} editing={txEditing} onClose={() => setTxEditing(null)} />
    </main>
  );
}

/** Texto sem valores em reais: só o mês fechado e proporções. */
async function shareClose(s: DemoState, month: string) {
  const r = monthCloseShare(s, month);
  const parts = [`Fechei ${monthYear(month).toLowerCase()} no Previdência Intelligence.`];
  if (r.ratio != null) parts.push(`Guardei ${formatPercent(r.ratio)} do que meu plano de aposentadoria pede por mês.`);
  else if (r.contributed) parts.push("Fiz o aporte do mês para a aposentadoria.");
  if (r.fi != null) parts.push(`Já estou em ${formatPercent(r.fi)} do caminho para não depender do INSS.`);
  const text = parts.join(" ");
  const url = window.location.origin;
  try {
    if (navigator.share) return void (await navigator.share({ text, url }));
    await navigator.clipboard.writeText(`${text} ${url}`);
    toast.success("Texto copiado. É só colar onde quiser.");
  } catch (e) {
    if ((e as Error).name !== "AbortError") toast.error("Não foi possível compartilhar agora.");
  }
}

function Step({ n, title, done, current, children }: { n: number; title: string; done: boolean; current: boolean; children: ReactNode }) {
  return (
    <li className={cn("rounded-2xl bg-card p-5 shadow-card", current && "ring-1 ring-primary/60")} aria-label={`Passo ${n}: ${title}${done ? ", feito" : ""}`}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
            done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {done ? <Check size={16} strokeWidth={3} /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={cn("text-base", done && "text-muted-foreground")}>{title}</h2>
          <div className="mt-2 text-sm">{children}</div>
        </div>
      </div>
    </li>
  );
}

function LedgerStep({ s, usesLedger, onImport, onAdd }: { s: DemoState; usesLedger: boolean; onImport: () => void; onAdd: () => void }) {
  if (!usesLedger)
    return (
      <p className="text-muted-foreground">
        Você ainda não usa o livro-caixa, então este passo fica de fora.{" "}
        <Link to="/contas" className="font-semibold text-primary hover:underline">
          Cadastrar uma conta
        </Link>
      </p>
    );
  const month = monthCloseSteps(s).month;
  const count = s.transactions.filter((t) => t.date.slice(0, 7) === month.slice(0, 7)).length;
  return (
    <>
      <p className="text-muted-foreground">
        {count ? `${count} ${count === 1 ? "lançamento" : "lançamentos"} neste mês.` : "Nada lançado neste mês ainda."} O jeito mais rápido é importar o
        extrato do banco.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onImport}>
          <FileUp size={14} aria-hidden /> Importar extrato
        </Button>
        <Button size="sm" variant="outline" onClick={onAdd}>
          Lançar à mão
        </Button>
      </div>
    </>
  );
}

function CategorizeStep({ s, rows, usesLedger }: { s: DemoState; rows: DemoState["transactions"]; usesLedger: boolean }) {
  const [remember, setRemember] = useState(true);
  const groups = uncategorizedGroups(rows);
  if (!usesLedger) return <p className="text-muted-foreground">Sem livro-caixa, nada para categorizar.</p>;
  if (rows.length === 0) return <p className="text-muted-foreground">Tudo do mês tem categoria.</p>;
  return (
    <>
      <p className="text-muted-foreground">
        {rows.length === 1 ? "1 lançamento está" : `${rows.length} lançamentos estão`} sem categoria. Lançamentos com a mesma descrição vão juntos.
      </p>
      <ul className="mt-3 divide-y divide-border">
        {groups.slice(0, 10).map((g) => (
          <li key={g.key} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{g.payee}</span>
              <span className="money block text-xs text-muted-foreground">
                {g.items.length === 1
                  ? `${formatDate(`${g.items[0]!.date}T12:00:00Z`)} · ${formatMoney(g.total)}`
                  : `${g.items.length} lançamentos · ${formatMoney(g.total)}`}
              </span>
            </span>
            <Select
              onValueChange={(categoryId) => {
                // A regra é gravada uma vez; os demais só recebem a categoria. Se um falhar, conta quantos foram.
                let done = 0;
                const ok = runAction(() => {
                  g.items.forEach((t, i) => {
                    demo.updateTransaction(t.id, { categoryId, remember: remember && i === 0 });
                    done++;
                  });
                });
                const n = done === 1 ? "Categorizado" : `${done} lançamentos categorizados`;
                if (ok) toast.success(remember ? `${n}. “${g.payee}” vai para essa categoria nas próximas vezes.` : `${n}.`);
                else if (done) toast(`${n} antes do erro.`);
              }}
            >
              <SelectTrigger className="h-10 w-40 shrink-0 rounded-xl bg-muted" aria-label={`Categoria de ${g.payee}`}>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {s.categories
                  .filter((c) => c.kind === (g.income ? "receita" : "despesa"))
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
      {groups.length > 10 && (
        <p className="mt-2 text-xs text-muted-foreground">Mostrando 10 de {groups.length} descrições. As próximas aparecem conforme você categoriza.</p>
      )}
      <label className="mt-3 flex min-h-11 items-center justify-between gap-4 rounded-xl bg-muted px-4">
        <span className="text-sm">Lembrar a categoria para a mesma descrição</span>
        <Switch checked={remember} onCheckedChange={setRemember} />
      </label>
    </>
  );
}

function BudgetStep({ s, month }: { s: DemoState; month: string }) {
  if (budgetModeOf(s) === "simples") return <LimitStep s={s} />;
  return <EnvelopeStep s={s} month={month} />;
}

/** Modo Simples: o passo é ter ao menos um limite de gasto para acompanhar o mês. */
function LimitStep({ s }: { s: DemoState }) {
  const [open, setOpen] = useState(false);
  const active = (s.limits ?? []).filter((l) => l.active).length;
  return (
    <>
      <p className="text-muted-foreground">
        {active
          ? `${active === 1 ? "1 limite de gasto acompanha" : `${active} limites de gasto acompanham`} o seu mês.`
          : "Defina quanto quer gastar no mês (no total ou numa categoria). O app avisa quando chegar perto."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant={active ? "outline" : "default"} onClick={() => setOpen(true)}>
          {active ? "Ajustar limites" : "Definir um limite"}
        </Button>
      </div>
      <LimitsSheet s={s} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function EnvelopeStep({ s, month }: { s: DemoState; month: string }) {
  const v = budgetView(s, month);
  const toBudget = v.month.toBudget;
  function apply() {
    const r = demo.applyTemplates(month);
    xpToast(`Metas aplicadas: ${formatMoney(r.total)} distribuídos.`, r.xpAwarded);
    handleResult(r);
  }
  return (
    <>
      <p className="text-muted-foreground">
        {toBudget > 0
          ? `Ainda há ${formatMoney(toBudget)} sem destino.`
          : toBudget < 0
            ? `Você distribuiu ${formatMoney(-toBudget)} a mais do que entrou.`
            : "Cada real tem um destino."}
        {v.overspentNow.length > 0 && ` ${v.overspentNow.length === 1 ? "1 envelope estourou" : `${v.overspentNow.length} envelopes estouraram`}.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {v.hasTemplates && (
          <Button size="sm" onClick={apply}>
            Aplicar minhas metas
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to="/orcamento">Abrir o orçamento</Link>
        </Button>
      </div>
    </>
  );
}

function ContributionStep({ s, month, done, onTransfer }: { s: DemoState; month: string; done: boolean; onTransfer: () => void }) {
  const record = s.contributions.filter((c) => c.month === month).at(-1);
  const env = budgetView(s, month).retirement;
  const expected = env.balance > 0 ? env.balance : Math.round((s.plan?.inputs.monthlyContribution ?? 0) * 100);
  if (done && record)
    return (
      <p className="text-muted-foreground">
        {record.made ? `Aporte registrado${record.amount ? `: ${formatMonthly(record.amount)}` : ""}.` : "Você registrou que não conseguiu aportar este mês. Tudo bem: o fio continua."}
      </p>
    );
  function skip() {
    const r = demo.logContribution({ month, made: false });
    xpToast("Tudo bem. Este mês fica registrado e o plano segue.", r.xpAwarded);
    handleResult(r);
  }
  return (
    <>
      <p className="text-muted-foreground">
        {expected > 0 ? `O previsto para este mês é ${formatMoney(expected)}.` : "Registre quanto você guardou para o futuro este mês."} Transferir para a
        previdência pelo livro-caixa já conta como aporte.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {s.accounts.length > 0 && (
          <Button size="sm" onClick={onTransfer}>
            Transferir
          </Button>
        )}
        <Button asChild size="sm" variant={s.accounts.length ? "outline" : "default"}>
          <Link to="/diario" search={{ registrar: true }}>
            Registrar aporte
          </Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={skip}>
          Não consegui este mês
        </Button>
      </div>
    </>
  );
}

function WealthStep({ s, done }: { s: DemoState; done: boolean }) {
  const snap = assetSnapshot(s);
  function fromAssets() {
    try {
      const r = demo.logWealthFromAssets();
      xpToast("Patrimônio do mês registrado com os seus itens.", r.xpAwarded);
      handleResult(r);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  if (done) return <p className="text-muted-foreground">Patrimônio do mês registrado.</p>;
  return (
    <>
      <p className="text-muted-foreground">
        {snap ? `Seus itens somam ${formatWealth(snap.total)} para a aposentadoria. Confira se estão atualizados e registre.` : "Registre quanto você tem guardado hoje."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {snap && (
          <Button size="sm" onClick={fromAssets}>
            Registrar com os itens
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to="/patrimonio" search={snap ? {} : { registrar: true }}>
            {snap ? "Revisar os itens" : "Registrar patrimônio"}
          </Link>
        </Button>
      </div>
    </>
  );
}
