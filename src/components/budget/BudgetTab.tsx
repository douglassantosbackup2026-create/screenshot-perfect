// Aba Orçamento do Plano: "a distribuir", o envelope Aposentadoria ligado ao plano, os envelopes de gasto e as contas fixas.
// Só exibe; as contas vêm de src/lib/calc/budget.ts por src/lib/data/selectors.ts.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Repeat, Sparkles, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NumberField, Segmented } from "@/components/forms";
import { handleResult, xpToast } from "@/components/feedback";
import { toCents } from "@/lib/calc/ledger";
import { RETIREMENT_ENVELOPE, type BudgetTemplate, type TemplateKind } from "@/lib/calc/budget";
import { formatMoney, formatMonthly, formatPercent } from "@/lib/calc/format";
import { BUDGET_MONTHS_AHEAD, demo, type DemoState } from "@/lib/data/demo-store";
import { billsOfMonth, budgetView } from "@/lib/data/selectors";
import { addMonths, monthOf, spDate } from "@/lib/gamification/rules";
import { formatDate, monthYear } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Envelope = ReturnType<typeof budgetView>["spending"][number];
const dayLabel = (d: string) => formatDate(`${d}T12:00:00Z`);

const templateLabel = (t: BudgetTemplate) =>
  t.kind === "fixo"
    ? `${formatMoney(t.amount ?? 0)} por mês`
    : t.kind === "percentual"
      ? `${t.percent}% da renda`
      : `Juntar ${formatMoney(t.target ?? 0)} até ${monthYear(t.deadline ?? "").toLowerCase()}`;

export function BudgetTab({ s }: { s: DemoState }) {
  const current = monthOf(spDate(new Date()));
  const [month, setMonth] = useState(current);
  const [editing, setEditing] = useState<Envelope | null>(null);
  const [moving, setMoving] = useState<Envelope | null>(null);
  const v = budgetView(s, month);
  const bills = billsOfMonth(s, month);
  const toBudget = v.month.toBudget;

  function applyTemplates() {
    const r = demo.applyTemplates(month);
    xpToast(`Metas aplicadas: ${formatMoney(r.total)} distribuídos.`, r.xpAwarded);
    handleResult(r);
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => setMonth(addMonths(month, -1))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card hover:text-primary"
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <p className="font-semibold">
          {monthYear(month)}
          {month > current && <span className="ml-2 text-xs font-normal text-muted-foreground">planejando</span>}
        </p>
        <button
          type="button"
          aria-label="Próximo mês"
          disabled={month >= addMonths(current, BUDGET_MONTHS_AHEAD)}
          onClick={() => setMonth(addMonths(month, 1))}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-card hover:text-primary disabled:opacity-40"
        >
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <section
          className={cn(
            "rounded-3xl p-6 lg:col-span-5",
            toBudget < 0 ? "bg-card text-foreground shadow-card ring-1 ring-destructive/60" : "bg-primary text-primary-foreground shadow-[0_20px_48px_-20px_rgb(246_200_0/0.55)]",
          )}
          aria-label="A distribuir"
        >
          <p className={cn("eyebrow", toBudget >= 0 && "!text-primary-foreground/70")}>A distribuir</p>
          <p className={cn("money mt-2 font-display text-5xl font-bold leading-none", toBudget < 0 && "text-destructive")}>{formatMoney(toBudget)}</p>
          <p className={cn("mt-3 text-sm", toBudget >= 0 ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {toBudget > 0
              ? "Ainda tem dinheiro sem destino. Dê um envelope para cada real."
              : toBudget === 0
                ? "Cada real tem um destino. Assim se faz."
                : "Você distribuiu mais do que entrou. Tire de algum envelope."}
          </p>
          <dl className={cn("mt-4 space-y-1 text-sm", toBudget >= 0 ? "text-primary-foreground/80" : "text-muted-foreground")}>
            <div className="flex justify-between gap-4">
              <dt>Renda do mês</dt>
              <dd className="money">{formatMoney(v.month.income)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Distribuído no mês</dt>
              <dd className="money">{formatMoney(v.month.assigned)}</dd>
            </div>
            {v.month.overspentFromPrevious > 0 && (
              <div className="flex justify-between gap-4">
                <dt>Estouros do mês anterior</dt>
                <dd className="money">−{formatMoney(v.month.overspentFromPrevious)}</dd>
              </div>
            )}
          </dl>
          {v.hasTemplates && (
            <Button variant={toBudget >= 0 ? "dark" : "outline"} className="mt-5 w-full" onClick={applyTemplates}>
              <Sparkles size={16} aria-hidden /> Aplicar minhas metas neste mês
            </Button>
          )}
        </section>

        <RetirementCard s={s} v={v} month={month} onTemplate={() => setEditing(v.retirement)} />

        <section className="rounded-2xl bg-card p-5 shadow-card lg:col-span-8" aria-label="Envelopes">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg">Envelopes</h2>
            <Link to="/contas" className="text-sm font-semibold text-primary hover:underline">
              Nova categoria
            </Link>
          </div>
          {v.overspentNow.length > 0 && (
            <p className="mt-2 text-sm text-destructive">
              {v.overspentNow.length === 1 ? "1 envelope estourou" : `${v.overspentNow.length} envelopes estouraram`}. Cubra com outro envelope ou o
              valor sai do “a distribuir” do mês que vem.
            </p>
          )}
          <div className="mt-3 hidden grid-cols-[1fr_8rem_7rem_7rem] gap-3 px-1 text-xs text-muted-foreground sm:grid">
            <span>Envelope</span>
            <span className="text-right">Distribuído</span>
            <span className="text-right">Gasto</span>
            <span className="text-right">Disponível</span>
          </div>
          <ul className="mt-1 divide-y divide-border">
            {v.spending.map((e) => (
              <EnvelopeRow key={e.id} e={e} month={month} onEdit={() => setEditing(e)} onMove={() => setMoving(e)} />
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-card p-5 shadow-card lg:col-span-4" aria-label="Contas fixas do mês">
          <h2 className="flex items-center gap-2 text-lg">
            <Repeat size={18} className="text-primary" aria-hidden /> Contas fixas
          </h2>
          {bills.items.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Cadastre aluguel, assinaturas e outras contas como recorrentes no{" "}
              <Link to="/diario" className="font-semibold text-primary hover:underline">
                Diário
              </Link>
              .
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="money">{formatMoney(bills.done)}</span> lançados de <span className="money">{formatMoney(bills.total)}</span>
              </p>
              <Progress value={bills.total ? (bills.done / bills.total) * 100 : 0} className="mt-3" aria-label="Contas fixas lançadas" />
              <ul className="mt-3 divide-y divide-border text-sm">
                {bills.items.map((b) => (
                  <li key={`${b.rule.id}-${b.date}`} className="flex items-center justify-between gap-4 py-2">
                    <span>
                      <span className="block font-semibold">{b.rule.payee}</span>
                      <span className="block text-xs text-muted-foreground">
                        {dayLabel(b.date)} · {b.status === "lancada" ? "lançada" : b.status === "a_vencer" ? "a vencer" : "pendente"}
                      </span>
                    </span>
                    <span className="money whitespace-nowrap">{formatMoney(-b.rule.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Entram no orçamento as contas do dia a dia e o cartão. O que vai para previdência e investimentos sai pelo envelope Aposentadoria;
        saldo que sobra num envelope passa para o mês seguinte.
      </p>

      <TemplateSheet envelope={editing} onClose={() => setEditing(null)} />
      <MoveSheet s={s} v={v} month={month} from={moving} onClose={() => setMoving(null)} />
    </div>
  );
}

/** Campo de valor que grava ao sair do campo; volta ao valor salvo se o mês ou o valor mudarem. */
function AssignInput({ month, envelopeId, value, label }: { month: string; envelopeId: string; value: number; label: string }) {
  const [text, setText] = useState(value ? String(value / 100) : "");
  useEffect(() => setText(value ? String(value / 100) : ""), [month, value]);
  function commitValue() {
    const reais = text.trim() === "" ? 0 : Number(text.replace(",", "."));
    if (!Number.isFinite(reais)) return setText(value ? String(value / 100) : "");
    const cents = toCents(reais);
    if (cents === value) return;
    try {
      const r = demo.setAssigned(month, envelopeId, cents);
      if (r.xpAwarded) xpToast("Mês planejado.", r.xpAwarded);
      handleResult(r);
    } catch (e) {
      toast.error((e as Error).message);
      setText(value ? String(value / 100) : "");
    }
  }
  return (
    <Input
      aria-label={`Distribuído em ${label}`}
      inputMode="decimal"
      value={text}
      placeholder="0"
      onChange={(e) => setText(e.target.value)}
      onBlur={commitValue}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="money h-10 rounded-xl bg-muted text-right"
    />
  );
}

function EnvelopeRow({ e, month, onEdit, onMove }: { e: Envelope; month: string; onEdit: () => void; onMove: () => void }) {
  return (
    <li className="grid grid-cols-[1fr_7rem] items-center gap-x-3 gap-y-1 py-3 sm:grid-cols-[1fr_8rem_7rem_7rem]">
      <div className="min-w-0">
        <button type="button" onClick={onEdit} className="truncate text-left font-semibold hover:text-primary">
          {e.name}
        </button>
        <p className="truncate text-xs text-muted-foreground">
          {e.template ? (
            <>
              <Target size={12} className="mr-1 inline text-primary" aria-hidden />
              {templateLabel(e.template)}
              {e.suggested !== null && e.suggested !== e.assigned && ` · pede ${formatMoney(e.suggested)}`}
            </>
          ) : (
            <button type="button" onClick={onEdit} className="hover:text-foreground">
              Definir meta
            </button>
          )}
        </p>
        {e.progress !== null && <Progress value={e.progress * 100} className="mt-1.5 h-1.5" aria-label={`Progresso de ${e.name}`} />}
      </div>
      <AssignInput month={month} envelopeId={e.id} value={e.assigned} label={e.name} />
      <span className="money hidden text-right text-sm text-muted-foreground sm:block">{formatMoney(-e.activity)}</span>
      <button
        type="button"
        onClick={onMove}
        aria-label={`Disponível em ${e.name}: ${formatMoney(e.balance)}. Mover dinheiro`}
        className={cn(
          "money col-start-2 justify-self-end whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold sm:col-start-auto",
          e.balance < 0 ? "bg-destructive/15 text-destructive" : e.balance > 0 ? "bg-primary/15 text-primary" : "text-muted-foreground",
        )}
      >
        {formatMoney(e.balance)}
      </button>
    </li>
  );
}

function RetirementCard({ s, v, month, onTemplate }: { s: DemoState; v: ReturnType<typeof budgetView>; month: string; onTemplate: () => void }) {
  const e = v.retirement;
  const impact = v.impact;
  const short = impact ? impact.budgetedMonthly < impact.requiredMonthly : false;
  return (
    <section className="rounded-2xl bg-card p-5 shadow-card ring-1 ring-primary/40 lg:col-span-7" aria-label="Envelope Aposentadoria">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Envelope prioritário</p>
          <h2 className="mt-1 text-lg">Aposentadoria</h2>
        </div>
        <Button size="sm" variant="ghost" onClick={onTemplate}>
          {e.template ? "Meta" : "Definir meta"}
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-3 items-end gap-3">
        <div className="col-span-1">
          <p className="text-xs text-muted-foreground">Distribuído</p>
          <AssignInput month={month} envelopeId={RETIREMENT_ENVELOPE} value={e.assigned} label="Aposentadoria" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Já aportado</p>
          <p className="money font-display text-xl font-bold">{formatMoney(-e.activity)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Falta transferir</p>
          <p className={cn("money font-display text-xl font-bold", e.balance > 0 && "text-primary")}>{formatMoney(Math.max(e.balance, 0))}</p>
        </div>
      </div>
      {impact ? (
        <div className="mt-4 rounded-2xl bg-muted p-4 text-sm">
          <p>
            O plano pede cerca de <strong className="money">{formatMonthly(impact.requiredMonthly)}</strong> por mês (cenário central, sem INSS).
          </p>
          <p className="mt-2 text-muted-foreground">
            Aportando <span className="money">{formatMonthly(impact.budgetedMonthly)}</span> todo mês, o patrimônio sustentaria uma renda de cerca de{" "}
            <strong className="money text-foreground">{formatMonthly(impact.sustainableIncomeWithBudget)}</strong>, ou{" "}
            <span className="money">{formatPercent(impact.coverageWithBudget)}</span> da renda que você quer.
            {short && " Cada real a mais neste envelope aproxima o plano."}
          </p>
          {Math.abs(impact.budgetedMonthly - (s.plan?.inputs.monthlyContribution ?? 0)) >= 1 && (
            <p className="mt-2 text-xs text-muted-foreground">
              O plano usa <span className="money">{formatMonthly(s.plan?.inputs.monthlyContribution ?? 0)}</span> de aporte. Ajuste em Premissas se o
              orçado for o novo normal.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">Monte o plano para ver quanto este envelope precisa receber.</p>
      )}
      {e.balance > 0 && (
        <p className="mt-3 text-sm">
          Transfira para a previdência no{" "}
          <Link to="/diario" search={{ lancar: true }} className="font-semibold text-primary hover:underline">
            Diário
          </Link>{" "}
          e marque como aporte do mês.
        </p>
      )}
    </section>
  );
}

function TemplateSheet({ envelope, onClose }: { envelope: Envelope | null; onClose: () => void }) {
  const t = envelope?.template ?? null;
  const [kind, setKind] = useState<TemplateKind>("fixo");
  const [amount, setAmount] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [deadline, setDeadline] = useState("");
  const [percent, setPercent] = useState<number | null>(null);
  useEffect(() => {
    setKind(t?.kind ?? "fixo");
    setAmount(t?.amount ? t.amount / 100 : null);
    setTarget(t?.target ? t.target / 100 : null);
    setDeadline(t?.deadline ? t.deadline.slice(0, 7) : "");
    setPercent(t?.percent ?? null);
  }, [envelope, t]);
  if (!envelope) return null;

  function save() {
    try {
      demo.saveTemplate({
        envelopeId: envelope!.id,
        kind,
        amount: kind === "fixo" ? toCents(amount ?? 0) : null,
        target: kind === "ate_data" ? toCents(target ?? 0) : null,
        deadline: kind === "ate_data" && deadline ? `${deadline}-01` : null,
        percent: kind === "percentual" ? percent : null,
      });
      toast.success("Meta do envelope salva.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-[480px] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">Meta de {envelope.name}</SheetTitle>
          <SheetDescription>O botão “Aplicar minhas metas” preenche o mês com o que cada meta pede. Você sempre pode mudar à mão.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4 pb-4">
          <Segmented
            label="Tipo de meta"
            value={kind}
            onChange={setKind}
            options={[
              { value: "fixo", label: "Valor fixo" },
              { value: "ate_data", label: "Juntar até" },
              { value: "percentual", label: "% da renda" },
            ]}
          />
          {kind === "fixo" && <NumberField label="Valor por mês" value={amount} onChange={setAmount} prefix="R$" min={0} step={0.01} />}
          {kind === "ate_data" && (
            <>
              <NumberField label="Quanto quer juntar" value={target} onChange={setTarget} prefix="R$" min={0} step={0.01} hint="Bom para viagem, IPVA, presentes: um cofrinho com prazo." />
              <div>
                <label htmlFor="tpl-deadline" className="text-sm font-semibold">
                  Até
                </label>
                <Input id="tpl-deadline" type="month" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1.5 h-11" />
              </div>
            </>
          )}
          {kind === "percentual" && <NumberField label="Porcentagem da renda do mês" value={percent} onChange={setPercent} suffix="%" min={1} max={100} step={1} />}
          <Button className="w-full" onClick={save}>
            Salvar meta
          </Button>
          {t && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                demo.deleteTemplate(envelope.id);
                onClose();
              }}
            >
              Remover meta
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MoveSheet({ s, v, month, from, onClose }: { s: DemoState; v: ReturnType<typeof budgetView>; month: string; from: Envelope | null; onClose: () => void }) {
  const [other, setOther] = useState<string | undefined>(undefined);
  const [amount, setAmount] = useState<number | null>(null);
  useEffect(() => {
    setOther(undefined);
    setAmount(from ? Math.abs(from.balance) / 100 || null : null);
  }, [from]);
  if (!from) return null;
  // Estourado: traz dinheiro de outro envelope. Com saldo: leva para outro.
  const pulling = from.balance < 0;
  const options = [v.retirement, ...v.spending].filter((e) => e.id !== from.id);

  function save() {
    try {
      const cents = toCents(amount ?? 0);
      if (!other) throw new Error("Escolha o outro envelope.");
      if (pulling) demo.moveBudget(month, other, from!.id, cents);
      else demo.moveBudget(month, from!.id, other, cents);
      toast.success("Dinheiro movido.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-[480px] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">{pulling ? `Cobrir ${from.name}` : `Mover de ${from.name}`}</SheetTitle>
          <SheetDescription>
            Disponível em {from.name}: <span className="money">{formatMoney(from.balance)}</span>
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4 pb-4">
          <NumberField label="Valor" value={amount} onChange={setAmount} prefix="R$" min={0} step={0.01} />
          <div>
            <p className="text-sm font-semibold">{pulling ? "Tirar de" : "Levar para"}</p>
            <Select value={other ?? ""} onValueChange={setOther}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl bg-muted" aria-label={pulling ? "Tirar de" : "Levar para"}>
                <SelectValue placeholder="Escolha o envelope" />
              </SelectTrigger>
              <SelectContent>
                {options.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {formatMoney(e.balance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" disabled={s.categories.length === 0} onClick={save}>
            Mover
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
