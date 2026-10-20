import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConstancyThread } from "@/components/ConstancyThread";
import { LedgerSection } from "@/components/ledger/LedgerSection";
import type { TxEditing } from "@/components/ledger/TransactionSheet";
import { NumberField } from "@/components/forms";
import { handleResult, xpToast } from "@/components/feedback";
import { demo, useDemo, type Contribution, type Destination } from "@/lib/data/demo-store";
import { threadMonths } from "@/lib/data/thread";
import { formatMonthly, formatWealth } from "@/lib/calc/format";
import { DESTINATIONS, achievementInfo, monthName, monthYear, REASON_LABEL } from "@/lib/labels";
import { addMonths, monthOf, spDate } from "@/lib/gamification/rules";

export const Route = createFileRoute("/_authenticated/diario")({
  validateSearch: (s: Record<string, unknown>): { registrar?: boolean; lancar?: boolean } => ({
    ...(s["registrar"] ? { registrar: true } : {}),
    ...(s["lancar"] ? { lancar: true } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Diário — Previdência Intelligence" },
      { name: "description", content: "O fio da constância e o dia a dia do dinheiro: aportes, gastos, receitas e extratos." },
      { property: "og:title", content: "Diário — Previdência Intelligence" },
      { property: "og:description", content: "O fio da constância e o dia a dia do dinheiro: aportes, gastos, receitas e extratos." },
    ],
  }),
  component: Diary,
});

function Diary() {
  const s = useDemo();
  const { registrar, lancar } = Route.useSearch();
  const navigate = useNavigate();
  const current = monthOf(spDate(new Date()));
  const [logMonth, setLogMonth] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [showValues, setShowValues] = useState(!s.profile.hideValues);
  const [txEditing, setTxEditing] = useState<TxEditing>(null);

  useEffect(() => {
    if (registrar || lancar) {
      if (registrar) setLogMonth(current);
      if (lancar) setTxEditing({ tx: null });
      navigate({ to: "/diario", search: {}, replace: true });
    }
  }, [registrar, lancar, current, navigate]);

  // Recorrências vencidas entram ao abrir o Diário; rodar de novo não duplica.
  useEffect(() => {
    demo.runRecurring();
  }, []);

  const months = threadMonths(s.contributions);
  const withContribution = months.filter((m) => m.state === "aporte").length;
  const total = s.contributions.reduce((a, c) => a + (c.made && c.amount ? c.amount : 0), 0);

  const tagsFor = (m: string) => {
    const t: string[] = [];
    s.snapshots.filter((x) => x.createdAt.slice(0, 7) === m.slice(0, 7)).forEach((x) => t.push(REASON_LABEL[x.reason] ?? x.reason));
    s.achievements.filter((a) => a.at.slice(0, 7) === m.slice(0, 7)).forEach((a) => t.push(achievementInfo(a.code).title));
    const pauses = s.weeks.filter((w) => w.status === "pausa" && w.weekStart.slice(0, 7) === m.slice(0, 7)).length;
    if (pauses) t.push("Semana de pausa");
    return [...new Set(t)];
  };

  const currentLogged = s.contributions.some((c) => c.month === current);

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-8 lg:max-w-3xl lg:px-8 lg:pb-12">
      <h1>Diário</h1>
      <Button className="mt-5 w-full" onClick={() => setLogMonth(current)} variant={currentLogged ? "outline" : "default"}>
        Registrar aporte de {monthName(current)}
      </Button>

      <div className="mt-6 flex items-center justify-between gap-3 text-sm">
        <p>
          {months.length} {months.length === 1 ? "mês" : "meses"} no fio · {withContribution} com aporte
        </p>
        <button
          type="button"
          onClick={() => setShowValues((v) => !v)}
          className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-muted-foreground hover:bg-muted"
          aria-pressed={showValues}
        >
          {showValues ? <EyeOff size={18} strokeWidth={1.75} aria-hidden /> : <Eye size={18} strokeWidth={1.75} aria-hidden />}
          {showValues ? <span className="money">{formatWealth(total)}</span> : "Mostrar total"}
        </button>
      </div>

      <section className="mt-6">
        <ConstancyThread
          months={months.map((m) => ({
            month: m.month,
            state: m.state,
            tags: tagsFor(m.month),
            highlight: highlight === m.month,
            onSelect: () => (m.items.length ? setDetail(m.month) : setLogMonth(m.month)),
          }))}
        />
      </section>

      <LedgerSection s={s} showValues={showValues} editing={txEditing} setEditing={setTxEditing} />

      <LogSheet
        month={logMonth}
        onClose={() => setLogMonth(null)}
        onSaved={(m) => {
          setHighlight(m);
          setTimeout(() => setHighlight(null), 1200);
        }}
      />
      <DetailSheet month={detail} items={detail ? s.contributions.filter((c) => c.month === detail) : []} onClose={() => setDetail(null)} />
    </main>
  );
}

function LogSheet({ month, onClose, onSaved }: { month: string | null; onClose: () => void; onSaved: (m: string) => void }) {
  const [made, setMade] = useState<boolean | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [dest, setDest] = useState<Destination | null>(null);
  const [note, setNote] = useState("");
  const current = monthOf(spDate(new Date()));
  useEffect(() => {
    setMade(null);
    setAmount(null);
    setDest(null);
    setNote("");
  }, [month]);
  if (!month) return null;
  const isCurrent = month === current;
  const isRecent = month >= addMonths(current, -1);

  function save(didContribute: boolean) {
    try {
      const r = demo.logContribution({ month: month!, made: didContribute, amount, destination: dest, note: note.trim() || null });
      if (didContribute) {
        xpToast(`Aporte de ${monthName(month!)} registrado.`, r.xpAwarded);
        onSaved(month!);
      } else xpToast("Tudo bem. Este mês fica registrado e o plano segue.", r.xpAwarded);
      handleResult(r);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-[480px] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">Registrar aporte</SheetTitle>
          <SheetDescription>
            {isCurrent ? "Você fez um aporte este mês?" : `Você fez um aporte em ${monthYear(month)}?`}
            {isRecent ? " O XP vem de registrar o mês, com ou sem aporte, nunca do valor." : " Meses antigos ficam no fio, sem XP."}
          </SheetDescription>
        </SheetHeader>
        {made === null ? (
          <div className="mt-6 grid gap-2 pb-4">
            <Button onClick={() => setMade(true)}>Sim</Button>
            <Button variant="outline" onClick={() => save(false)}>
              Não consegui este mês
            </Button>
          </div>
        ) : (
          <div className="mt-6 space-y-4 pb-4">
            <NumberField label="Valor" value={amount} onChange={setAmount} prefix="R$" optional hint="Só você vê." />
            <div>
              <p className="text-sm font-semibold">
                Destino <span className="font-normal text-muted-foreground">(opcional)</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Destino">
                {DESTINATIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    role="radio"
                    aria-checked={dest === d.value}
                    onClick={() => setDest(dest === d.value ? null : d.value)}
                    className={"min-h-10 rounded-full border px-4 text-sm " + (dest === d.value ? "border-primary font-semibold text-primary" : "border-border")}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="note" className="text-sm font-semibold">
                Nota <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <Textarea id="note" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
            </div>
            <Button className="w-full" onClick={() => save(true)}>
              Registrar aporte
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailSheet({ month, items, onClose }: { month: string | null; items: Contribution[]; onClose: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  if (!month) return null;
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-[480px] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">{monthYear(month)}</SheetTitle>
          <SheetDescription>Só você vê estes valores.</SheetDescription>
        </SheetHeader>
        <ul className="mt-4 space-y-4 pb-4">
          {items.map((c) => (
            <li key={c.id} className="rounded-2xl bg-card shadow-card p-4">
              {editing === c.id ? (
                <div className="space-y-3">
                  <NumberField label="Valor" value={amount} onChange={setAmount} prefix="R$" optional />
                  <label htmlFor={`n-${c.id}`} className="text-sm font-semibold">
                    Nota
                  </label>
                  <Input id={`n-${c.id}`} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />
                  <Button
                    size="sm"
                    onClick={() => {
                      demo.updateContribution(c.id, { amount, note: note || null });
                      setEditing(null);
                    }}
                  >
                    Salvar
                  </Button>
                </div>
              ) : (
                <>
                  <p className="font-semibold">{c.made ? "Com aporte" : "Sem aporte"}</p>
                  {c.made && (
                    <dl className="mt-2 space-y-1 text-sm">
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">Valor:</dt>
                        <dd className="money">{c.amount != null ? formatMonthly(c.amount) : "não informado"}</dd>
                      </div>
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground">Destino:</dt>
                        <dd>{DESTINATIONS.find((d) => d.value === c.destination)?.label ?? "não informado"}</dd>
                      </div>
                    </dl>
                  )}
                  {c.note && <p className="mt-2 text-sm">{c.note}</p>}
                  <div className="mt-3 flex gap-2">
                    {c.made && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(c.id);
                          setAmount(c.amount);
                          setNote(c.note ?? "");
                        }}
                      >
                        Editar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        demo.deleteContribution(c.id);
                        if (items.length === 1) onClose();
                      }}
                    >
                      Excluir
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
