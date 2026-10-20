// Lançar ou editar uma entrada, saída ou transferência.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NumberField, Segmented } from "@/components/forms";
import { handleResult, xpToast } from "@/components/feedback";
import { AccountSelect, CategoryChips } from "@/components/ledger/fields";
import { isSavingsAccount, toCents } from "@/lib/calc/ledger";
import { demo, type DemoState, type Destination, type Transaction } from "@/lib/data/demo-store";
import { spDate } from "@/lib/gamification/rules";

type Kind = "saida" | "entrada" | "transferencia";
export type TxEditing = { tx: Transaction | null } | null;

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

  useEffect(() => {
    if (!editing) return;
    setKind(tx ? (tx.transferId ? "transferencia" : tx.amount >= 0 ? "entrada" : "saida") : "saida");
    setAmount(tx ? Math.abs(tx.amount) / 100 : null);
    setPayee(tx?.payee ?? "");
    setAccountId(tx?.accountId ?? s.accounts[0]?.id ?? null);
    setToId(null);
    setDate(tx?.date ?? spDate(new Date()));
    setCategoryId(tx?.categoryId ?? null);
    setRemember(false);
    setAsContribution(true);
    setNote(tx?.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  if (!editing) return null;

  const to = s.accounts.find((a) => a.id === toId);
  const canContribute = kind === "transferencia" && !tx && !!to && isSavingsAccount(to.kind);
  const destination: Destination = to?.kind === "previdencia" ? "previdencia" : "investimentos";

  function save() {
    try {
      const cents = toCents(amount ?? 0);
      if (kind === "transferencia" && !tx) {
        const r = demo.addTransfer({ fromId: accountId ?? "", toId: toId ?? "", date, amount: cents, note: note.trim() || null, contribution: canContribute && asContribution ? destination : null });
        if (canContribute && asContribution) {
          xpToast("Transferência lançada e aporte registrado no Diário.", r.xpAwarded);
          handleResult(r);
        } else toast.success("Transferência lançada.");
      } else {
        const signed = kind === "entrada" || (tx?.transferId && tx.amount > 0) ? cents : -cents;
        if (tx) demo.updateTransaction(tx.id, { date, amount: signed, payee, categoryId, note: note.trim() || null, remember });
        else demo.addTransaction({ accountId: accountId ?? "", date, amount: signed, payee, categoryId, note: note.trim() || null, remember });
        toast.success(tx ? "Lançamento atualizado." : "Lançamento registrado.");
      }
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-[480px] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">{tx ? "Editar lançamento" : "Novo lançamento"}</SheetTitle>
          <SheetDescription>Só você vê estes valores. Lançar não dá XP; registrar o aporte do mês, sim.</SheetDescription>
        </SheetHeader>
        {s.accounts.length === 0 ? (
          <p className="mt-6 pb-4 text-sm text-muted-foreground">Cadastre uma conta em Contas para começar a lançar.</p>
        ) : (
          <div className="mt-6 space-y-4 pb-4">
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
            <NumberField label="Valor" value={amount} onChange={setAmount} prefix="R$" min={0} step={0.01} />
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
                <span className="text-sm">Registrar como aporte do mês no Diário</span>
                <Switch checked={asContribution} onCheckedChange={setAsContribution} />
              </label>
            )}
            <div>
              <label htmlFor="tx-note" className="text-sm font-semibold">
                Nota <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <Textarea id="tx-note" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
            </div>
            <Button className="w-full" onClick={save}>
              {tx ? "Salvar alterações" : "Lançar"}
            </Button>
            {tx && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  demo.deleteTransaction(tx.id);
                  toast(tx.transferId ? "Transferência excluída nas duas contas." : "Lançamento excluído.");
                  onClose();
                }}
              >
                Excluir lançamento
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
