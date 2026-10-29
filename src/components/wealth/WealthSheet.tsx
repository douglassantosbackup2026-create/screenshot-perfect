// Registro do patrimônio de um mês: pelo total informado ou somando os itens do Patrimônio.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BottomSheetContent } from "@/components/BottomSheet";
import { NumberField } from "@/components/forms";
import { ConfirmButton } from "@/components/ConfirmButton";
import { handleResult, xpToast } from "@/components/feedback";
import { demo, type DemoState } from "@/lib/data/demo-store";
import { assetSnapshot } from "@/lib/data/selectors";
import { formatWealth } from "@/lib/calc/format";
import { monthOf, spDate } from "@/lib/gamification/rules";
import { JOURNEY_ENABLED } from "@/lib/features";
import { monthYear } from "@/lib/labels";
import { errMsg } from "@/lib/errors";

export function WealthSheet({ s, month, onClose }: { s: DemoState; month: string | null; onClose: () => void }) {
  const existing = month ? s.wealthEntries.find((w) => w.month === month) : undefined;
  const [total, setTotal] = useState<number | null>(null);
  const [previdencia, setPrevidencia] = useState<number | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    setTotal(existing?.total ?? null);
    setPrevidencia(existing?.previdencia ?? null);
    setNote(existing?.note ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);
  if (!month) return null;
  const snap = month === monthOf(spDate(new Date())) ? assetSnapshot(s) : null;

  function save(fromAssets = false) {
    try {
      const r = fromAssets
        ? demo.logWealthFromAssets(note.trim() || null)
        : demo.logWealth({ month: month!, total: total ?? NaN, previdencia, note: note.trim() || null });
      xpToast(`Patrimônio de ${monthYear(month!).toLowerCase()} registrado.`, r.xpAwarded);
      handleResult(r);
      onClose();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <BottomSheetContent>
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">Patrimônio de {monthYear(month).toLowerCase()}</SheetTitle>
          <SheetDescription>
            Some o que você tem guardado para o futuro.{JOURNEY_ENABLED && " O XP vem do hábito de registrar, nunca do valor."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4 pb-4">
          {snap && snap.total > 0 && (
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-sm">
                Seus itens do Patrimônio somam <span className="money font-semibold">{formatWealth(snap.total)}</span> para a aposentadoria.
              </p>
              <Button className="mt-3 w-full" onClick={() => save(true)}>
                Registrar com os itens do Patrimônio
              </Button>
            </div>
          )}
          {existing?.breakdown && (
            <ul className="space-y-1 text-sm text-muted-foreground" aria-label="Itens deste registro">
              {existing.breakdown.map((b) => (
                <li key={b.assetId} className="flex justify-between gap-4">
                  <span>{b.name}</span>
                  <span className="money">{formatWealth(b.value)}</span>
                </li>
              ))}
            </ul>
          )}
          <NumberField label="Total guardado" value={total} onChange={setTotal} prefix="R$" hint="Só você vê." />
          <NumberField label="Quanto disso está em previdência" value={previdencia} onChange={setPrevidencia} prefix="R$" optional />
          <div>
            <label htmlFor="wealth-note" className="text-sm font-semibold">
              Nota <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Textarea id="wealth-note" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
          </div>
          <Button variant={snap && snap.total > 0 ? "outline" : "default"} className="w-full" onClick={() => save()}>
            {existing ? "Atualizar registro" : "Registrar este total"}
          </Button>
          {existing && (
            <ConfirmButton
              className="w-full"
              onConfirm={() => {
                demo.deleteWealth(existing.id);
                toast("Registro excluído.");
                onClose();
              }}
            >
              Excluir registro
            </ConfirmButton>
          )}
        </div>
      </BottomSheetContent>
    </Sheet>
  );
}
