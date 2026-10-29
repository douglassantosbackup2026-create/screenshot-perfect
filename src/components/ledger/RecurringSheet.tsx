// Lançamentos recorrentes: lista, criação e edição.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BottomSheetContent } from "@/components/BottomSheet";
import { NumberField, Segmented } from "@/components/forms";
import { AccountSelect, CategoryChips } from "@/components/ledger/fields";
import { fromCents, toCents } from "@/lib/calc/ledger";
import { FREQUENCIES, nextOccurrence, type Frequency, type WeekendRule } from "@/lib/calc/recurring";
import { formatMoney } from "@/lib/calc/format";
import { demo, type DemoState, type RecurringRule } from "@/lib/data/demo-store";
import { spDate } from "@/lib/gamification/rules";
import { dayLabel } from "@/lib/labels";
import { errMsg } from "@/lib/errors";

const freqLabel = (r: RecurringRule) => {
  const unit = { semanal: "semanas", mensal: "meses", anual: "anos" }[r.frequency];
  return r.interval === 1 ? FREQUENCIES.find((f) => f.value === r.frequency)!.label : `A cada ${r.interval} ${unit}`;
};

export function RecurringSheet({ s, open, onClose }: { s: DemoState; open: boolean; onClose: () => void }) {
  const [editing, setEditing] = useState<{ rule: RecurringRule | null } | null>(null);
  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);
  if (!open) return null;
  const today = spDate(new Date());

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <BottomSheetContent>
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">{editing ? (editing.rule ? "Editar recorrência" : "Nova recorrência") : "Recorrentes"}</SheetTitle>
          <SheetDescription>Aluguel, assinaturas, salário: o app lança sozinho na data, sem duplicar.</SheetDescription>
        </SheetHeader>
        {editing ? (
          <RuleForm s={s} rule={editing.rule} onDone={() => setEditing(null)} />
        ) : (
          <div className="mt-6 space-y-3 pb-4">
            {s.recurring.every((r) => r.installment) && <p className="text-sm text-muted-foreground">Nenhuma recorrência ainda.</p>}
            <ul className="divide-y divide-border">
              {s.recurring.filter((r) => !r.installment).map((r) => {
                const next = nextOccurrence(r, today);
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => setEditing({ rule: r })} className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-3 text-left hover:bg-muted">
                      <span>
                        <span className="block font-semibold">{r.payee}</span>
                        <span className="block text-xs text-muted-foreground">
                          {freqLabel(r)} · {next ? `próxima em ${dayLabel(next.date)}` : "encerrada"}
                        </span>
                      </span>
                      <span className={"money text-sm " + (r.amount > 0 ? "text-primary" : "")}>{formatMoney(r.amount)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Button className="w-full" disabled={s.accounts.length === 0} onClick={() => setEditing({ rule: null })}>
              Nova recorrência
            </Button>
          </div>
        )}
      </BottomSheetContent>
    </Sheet>
  );
}

function RuleForm({ s, rule, onDone }: { s: DemoState; rule: RecurringRule | null; onDone: () => void }) {
  const [income, setIncome] = useState(rule ? rule.amount > 0 : false);
  const [amount, setAmount] = useState<number | null>(rule ? fromCents(Math.abs(rule.amount)) : null);
  const [payee, setPayee] = useState(rule?.payee ?? "");
  const [accountId, setAccountId] = useState<string | null>(rule?.accountId ?? s.accounts[0]?.id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(rule?.categoryId ?? null);
  const [startDate, setStartDate] = useState(rule?.startDate ?? spDate(new Date()));
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency ?? "mensal");
  const [every, setEvery] = useState<number | null>(rule?.interval ?? 1);
  const [endDate, setEndDate] = useState(rule?.endDate ?? "");
  const [weekend, setWeekend] = useState<WeekendRule>(rule?.weekend ?? "manter");

  function save() {
    try {
      const cents = toCents(amount ?? 0);
      demo.saveRecurring({
        id: rule?.id,
        active: rule?.active ?? true,
        accountId: accountId ?? "",
        amount: income ? cents : -cents,
        payee,
        categoryId,
        note: rule?.note ?? null,
        startDate,
        frequency,
        interval: every ?? 0,
        endDate: endDate || null,
        weekend,
      });
      toast.success("Recorrência salva. O que já venceu foi lançado.");
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <div className="mt-6 space-y-4 pb-4">
      <Segmented
        label="Tipo"
        value={income ? "entrada" : "saida"}
        onChange={(v) => {
          setIncome(v === "entrada");
          setCategoryId(null);
        }}
        options={[
          { value: "saida", label: "Saída" },
          { value: "entrada", label: "Entrada" },
        ]}
      />
      <NumberField label="Valor" value={amount} onChange={setAmount} prefix="R$" min={0} step={0.01} />
      <div>
        <label htmlFor="rec-payee" className="text-sm font-semibold">
          Descrição
        </label>
        <Input id="rec-payee" maxLength={120} value={payee} onChange={(e) => setPayee(e.target.value)} className="mt-1.5 h-11" placeholder="Ex.: Aluguel" />
      </div>
      <AccountSelect label="Conta" value={accountId} onChange={setAccountId} accounts={s.accounts} />
      <CategoryChips value={categoryId} onChange={setCategoryId} categories={s.categories} kind={income ? "receita" : "despesa"} />
      <Segmented label="Frequência" value={frequency} onChange={setFrequency} options={FREQUENCIES} />
      <NumberField label={frequency === "semanal" ? "A cada quantas semanas" : frequency === "mensal" ? "A cada quantos meses" : "A cada quantos anos"} value={every} onChange={setEvery} min={1} max={52} step={1} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="rec-start" className="text-sm font-semibold">
            Primeira vez
          </label>
          <Input id="rec-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5 h-11" />
        </div>
        <div>
          <label htmlFor="rec-end" className="text-sm font-semibold">
            Até <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <Input id="rec-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1.5 h-11" />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">Se cair no fim de semana</p>
        <div className="mt-2">
          <Segmented
            label="Se cair no fim de semana"
            value={weekend}
            onChange={setWeekend}
            options={[
              { value: "manter", label: "Manter" },
              { value: "antes", label: "Sexta antes" },
              { value: "depois", label: "Segunda depois" },
            ]}
          />
        </div>
      </div>
      <Button className="w-full" onClick={save}>
        Salvar recorrência
      </Button>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={onDone}>
          Voltar
        </Button>
        {rule && (
          <Button
            variant="ghost"
            className="flex-1"
            onClick={() => {
              demo.deleteRecurring(rule.id);
              toast("Recorrência removida. O que já foi lançado continua.");
              onDone();
            }}
          >
            Remover
          </Button>
        )}
      </div>
    </div>
  );
}
