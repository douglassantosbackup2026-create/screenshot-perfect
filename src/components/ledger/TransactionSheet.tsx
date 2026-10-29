// Lançar ou editar uma entrada, saída ou transferência.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BottomSheetContent } from "@/components/BottomSheet";
import { NumberField, Segmented } from "@/components/forms";
import { handleResult, xpToast } from "@/components/feedback";
import { JOURNEY_ENABLED } from "@/lib/features";
import { AccountSelect, CategoryChips } from "@/components/ledger/fields";
import { fromCents, isSavingsAccount, toCents } from "@/lib/calc/ledger";
import { formatMoney } from "@/lib/calc/format";
import { installmentSchedule, MAX_INSTALLMENTS, validateInstallments } from "@/lib/calc/installments";
import { envelopeAfterExpense, quickEntryDraft } from "@/lib/data/selectors";
import { HIDDEN } from "@/lib/labels";
import { demo, type DemoState, type Destination, type Transaction } from "@/lib/data/demo-store";
import { spDate } from "@/lib/gamification/rules";
import { errMsg } from "@/lib/errors";

type Kind = "saida" | "entrada" | "transferencia";

/** Toast com o botão "Desfazer" (vale a última mudança; depois do toast, o Diário mantém a opção por 24 h). */
function withUndo(message: string, description?: string) {
  toast.success(message, {
    description,
    action: {
      label: "Desfazer",
      onClick: () => {
        try {
          toast(`${demo.undoLast()} desfeito.`);
        } catch (e) {
          toast.error(errMsg(e));
        }
      },
    },
  });
}
/** Lançamento proposto (por exemplo, a partir de uma frase): o formulário abre preenchido para conferir. */
export type TxDraft = {
  kind: "saida" | "entrada";
  amount: number | null; // centavos; na compra parcelada, o total
  payee: string;
  date: string;
  categoryId: string | null;
  installments: number | null;
};
export type TxEditing = { tx: Transaction | null; draft?: TxDraft } | null;

export function TransactionSheet({ s, editing, onClose }: { s: DemoState; editing: TxEditing; onClose: () => void }) {
  const tx = editing?.tx ?? null;
  const [kind, setKind] = useState<Kind>("saida");
  const [amount, setAmount] = useState<number | null>(null);
  const [payee, setPayee] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [date, setDate] = useState(spDate(new Date()));
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [remember, setRemember] = useState(false);
  const [asContribution, setAsContribution] = useState(true);
  const [note, setNote] = useState("");
  const [split, setSplit] = useState(false);
  const [count, setCount] = useState<number | null>(2);
  const [noteOpen, setNoteOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [phraseHint, setPhraseHint] = useState<string | null>(null);

  /** A frase só preenche o formulário; a pessoa confere e lança. */
  function fromPhrase(e: React.FormEvent) {
    e.preventDefault();
    if (!phrase.trim()) return;
    const { parsed, draft } = quickEntryDraft(s, phrase);
    if (parsed.missing.includes("valor")) return setPhraseHint("Faltou o valor. Ex.: “gastei 62 na farmácia”.");
    setKind(draft.kind);
    setAmount(draft.amount != null ? fromCents(draft.amount) : null);
    setPayee(draft.payee);
    setDate(draft.date);
    setCategoryId(draft.categoryId);
    setSplit(!!draft.installments);
    setCount(draft.installments ?? 2);
    setPhrase("");
    setPhraseHint(null);
  }

  useEffect(() => {
    if (!editing) return;
    const d = editing.draft;
    setNoteOpen(!!tx?.note);
    setPhrase("");
    setPhraseHint(null);
    setKind(tx ? (tx.transferId ? "transferencia" : tx.amount >= 0 ? "entrada" : "saida") : (d?.kind ?? "saida"));
    setAmount(tx ? fromCents(Math.abs(tx.amount)) : d?.amount != null ? fromCents(d.amount) : null);
    setPayee(tx?.payee ?? d?.payee ?? "");
    setAccountId(tx?.accountId ?? s.accounts[0]?.id ?? null);
    setToId(null);
    setDate(tx?.date ?? d?.date ?? spDate(new Date()));
    setCategoryId(tx?.categoryId ?? d?.categoryId ?? null);
    setRemember(false);
    setAsContribution(true);
    setNote(tx?.note ?? "");
    setSplit(!!d?.installments);
    setCount(d?.installments ?? 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  if (!editing) return null;

  const to = s.accounts.find((a) => a.id === toId);
  const canContribute = kind === "transferencia" && !tx && !!to && isSavingsAccount(to.kind);
  const destination: Destination = to?.kind === "previdencia" ? "previdencia" : "investimentos";
  const money = (cents: number) => (s.profile.hideValues ? HIDDEN : formatMoney(cents));
  const canSplit = !tx && kind === "saida";
  const splitting = canSplit && split;
  const totalCents = toCents(amount ?? 0);
  const n = count ?? 0;
  const schedule = splitting && validateInstallments(totalCents, n).length === 0 ? installmentSchedule(totalCents, n, date) : null;

  function save() {
    try {
      const cents = toCents(amount ?? 0);
      if (kind === "transferencia" && !tx) {
        const r = demo.addTransfer({ fromId: accountId ?? "", toId: toId ?? "", date, amount: cents, note: note.trim() || null, contribution: canContribute && asContribution ? destination : null });
        if (canContribute && asContribution) {
          xpToast("Transferência lançada e aporte registrado.", r.xpAwarded);
          handleResult(r);
        } else toast.success("Transferência lançada.");
      } else if (splitting) {
        demo.addInstallmentPurchase({ accountId: accountId ?? "", firstDate: date, total: cents, count: n, payee, categoryId, note: note.trim() || null });
        withUndo(`Compra parcelada: ${n}× de ${money(schedule?.[1]?.amount ?? Math.floor(cents / n))}`, "Cada parcela cai no seu mês, como as recorrentes.");
      } else {
        const signed = kind === "entrada" || (tx?.transferId && tx.amount > 0) ? cents : -cents;
        // O envelope antes de lançar: para o recibo e para avisar se ele chegou a 75% ou ao limite.
        const env = !tx && signed < 0 ? envelopeAfterExpense(s, categoryId, date, cents) : null;
        if (tx) {
          demo.updateTransaction(tx.id, { date, amount: signed, payee, categoryId, note: note.trim() || null, remember });
          withUndo("Lançamento atualizado.");
        } else {
          demo.addTransaction({ accountId: accountId ?? "", date, amount: signed, payee, categoryId, note: note.trim() || null, remember });
          withUndo(
            `Lançado: ${money(cents)}${env ? ` em ${env.name}` : ""}`,
            env ? `No mês, ${env.name}: ${money(env.spentAfter)}${env.available > 0 ? ` de ${money(env.available)}` : ""}.` : undefined,
          );
          if (env?.crossed)
            toast.warning(
              env.crossed === "limite"
                ? `${env.name}: o envelope chegou ao limite do mês.`
                : `${env.name}: já foi mais de 75% do envelope deste mês.`,
            );
        }
      }
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <BottomSheetContent>
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">{tx ? "Editar lançamento" : "Novo lançamento"}</SheetTitle>
          <SheetDescription>Só você vê estes valores.{JOURNEY_ENABLED && " Lançar não dá XP; registrar o aporte do mês, sim."}</SheetDescription>
        </SheetHeader>
        {s.accounts.length === 0 ? (
          <p className="mt-6 pb-4 text-sm text-muted-foreground">Cadastre uma conta em Contas para começar a lançar.</p>
        ) : (
          <div className="mt-6 space-y-4 pb-4">
            {!tx && !editing.draft && (
              <form onSubmit={fromPhrase}>
                <div className="flex gap-2">
                  <label htmlFor="quick-entry" className="sr-only">
                    Lançar por frase
                  </label>
                  <Input
                    id="quick-entry"
                    value={phrase}
                    onChange={(e) => {
                      setPhrase(e.target.value);
                      setPhraseHint(null);
                    }}
                    maxLength={160}
                    placeholder="Ou escreva: gastei 62 na farmácia"
                    className="h-11 rounded-xl"
                    aria-describedby="quick-entry-hint"
                  />
                  <Button type="submit" variant="outline" className="h-11 shrink-0">
                    Preencher
                  </Button>
                </div>
                <p id="quick-entry-hint" className={phraseHint ? "mt-1 text-sm text-destructive" : "sr-only"} aria-live="polite">
                  {phraseHint ?? "Escreva como falaria, com valor e descrição. Dá para usar ontem, dia 12 ou 6x de 95."}
                </p>
              </form>
            )}
            {!tx && (
              <Segmented
                label="Tipo"
                value={kind}
                onChange={setKind}
                options={[
                  { value: "saida", label: "Saída" },
                  { value: "entrada", label: "Entrada" },
                  { value: "transferencia", label: "Transferência" },
                ]}
              />
            )}
            <NumberField label={splitting ? "Valor total da compra" : "Valor"} value={amount} onChange={setAmount} prefix="R$" min={0} step={0.01} />
            {canSplit && (
              <div className="rounded-xl bg-muted px-4 py-3">
                <label className="flex min-h-8 items-center justify-between gap-4">
                  <span className="text-sm">Compra parcelada</span>
                  <Switch checked={split} onCheckedChange={setSplit} />
                </label>
                {split && (
                  <div className="mt-3 space-y-2">
                    <NumberField label="Número de parcelas" value={count} onChange={setCount} min={2} max={MAX_INSTALLMENTS} step={1} />
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                      {schedule
                        ? `${n}× de ${money(schedule[1]!.amount)}${schedule[0]!.amount !== schedule[1]!.amount ? ` (a primeira, ${money(schedule[0]!.amount)})` : ""} = ${money(totalCents)}. A primeira cai na data abaixo.`
                        : `De 2 a ${MAX_INSTALLMENTS} parcelas.`}
                    </p>
                  </div>
                )}
              </div>
            )}
            {kind !== "transferencia" && (
              <div>
                <label htmlFor="tx-payee" className="text-sm font-semibold">
                  Descrição
                </label>
                <Input id="tx-payee" maxLength={120} value={payee} onChange={(e) => setPayee(e.target.value)} className="mt-1.5 h-11" placeholder="Ex.: Supermercado" />
              </div>
            )}
            {!tx && <AccountSelect label={kind === "transferencia" ? "De" : "Conta"} value={accountId} onChange={setAccountId} accounts={s.accounts} />}
            {kind === "transferencia" && !tx && (
              <AccountSelect label="Para" value={toId} onChange={setToId} accounts={s.accounts.filter((a) => a.id !== accountId)} />
            )}
            <div>
              <label htmlFor="tx-date" className="text-sm font-semibold">
                Data
              </label>
              <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5 h-11" />
            </div>
            {kind !== "transferencia" && (
              <>
                <CategoryChips value={categoryId} onChange={setCategoryId} categories={s.categories} kind={kind === "entrada" ? "receita" : "despesa"} />
                {categoryId && payee.trim() && (
                  <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-muted px-4">
                    <span className="text-sm">Usar esta categoria sempre que a descrição for “{payee.trim()}”</span>
                    <Switch checked={remember} onCheckedChange={setRemember} />
                  </label>
                )}
              </>
            )}
            {canContribute && (
              <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-muted px-4">
                <span className="text-sm">Registrar também como aporte do mês</span>
                <Switch checked={asContribution} onCheckedChange={setAsContribution} />
              </label>
            )}
            {noteOpen ? (
              <div>
                <label htmlFor="tx-note" className="text-sm font-semibold">
                  Nota <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <Textarea id="tx-note" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
              </div>
            ) : (
              <button type="button" onClick={() => setNoteOpen(true)} className="min-h-11 text-sm font-semibold text-primary">
                + Adicionar nota
              </button>
            )}
            <Button className="w-full" onClick={save}>
              {tx ? "Salvar alterações" : splitting ? "Lançar compra parcelada" : "Lançar"}
            </Button>
            {tx && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  demo.deleteTransaction(tx.id);
                  withUndo(tx.transferId ? "Transferência excluída nas duas contas." : "Lançamento excluído.");
                  onClose();
                }}
              >
                Excluir lançamento
              </Button>
            )}
          </div>
        )}
      </BottomSheetContent>
    </Sheet>
  );
}
