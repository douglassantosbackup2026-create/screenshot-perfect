// Limites de gasto por período: lista com o quanto já foi usado e formulário para criar um novo.
// Só exibe; a conta vem de src/lib/calc/limits.ts por src/lib/data/selectors.ts.
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BottomSheetContent } from "@/components/BottomSheet";
import { NumberField, Segmented } from "@/components/forms";
import { formatPercent } from "@/lib/calc/format";
import { toCents } from "@/lib/calc/ledger";
import { LIMIT_PERIODS, type LimitPeriod } from "@/lib/calc/limits";
import { demo, type DemoState } from "@/lib/data/demo-store";
import { limitsView } from "@/lib/data/selectors";
import { cn } from "@/lib/utils";
import { errMsg } from "@/lib/errors";
import { useMoney } from "@/hooks/use-show-values";

const ALL = "todos";

export function LimitsSheet({
  s,
  open,
  onClose,
}: {
  s: DemoState;
  open: boolean;
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [period, setPeriod] = useState<LimitPeriod>("semana");
  const [amount, setAmount] = useState<number | null>(null);
  const money = useMoney();
  // Só calcula com a folha aberta; fechada, ela fica montada mas não aparece.
  const limits = open ? limitsView(s) : [];

  function save() {
    try {
      demo.saveLimit({
        categoryId: categoryId === ALL ? null : categoryId,
        period,
        amount: toCents(amount ?? 0),
      });
      toast.success("Limite criado. Você recebe um aviso a partir de 75%.");
      setAmount(null);
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <BottomSheetContent>
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">Limites de gasto</SheetTitle>
          <SheetDescription>
            Um teto para um período curto: por dia, semana, quinzena ou mês. O envelope diz quanto
            há no mês; o limite avisa quando o ritmo passou do combinado.
          </SheetDescription>
        </SheetHeader>

        {limits.length > 0 && (
          <ul className="mt-6 space-y-3">
            {limits.map((l) => (
              <li key={l.id} className="rounded-2xl bg-muted p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {l.name} <span className="font-normal text-muted-foreground">{l.per}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="money">{money(l.spent)}</span> de{" "}
                      <span className="money">{money(l.limit)}</span> · {formatPercent(l.pct)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Excluir o limite de ${l.name}`}
                    onClick={() => demo.deleteLimit(l.id)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
                <Progress
                  value={Math.min(l.pct, 1) * 100}
                  className="mt-2 h-2"
                  indicatorClassName={cn(l.level === "limite" && "bg-destructive")}
                  aria-label={`Uso do limite de ${l.name}`}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 space-y-4 pb-4">
          <h3 className="text-base">Novo limite</h3>
          <div>
            <label className="text-sm font-semibold" htmlFor="limit-category">
              Em quê
            </label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="limit-category" className="mt-1.5 h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os gastos</SelectItem>
                {s.categories
                  .filter((c) => c.kind === "despesa")
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Segmented
            label="Período"
            value={period}
            onChange={setPeriod}
            options={LIMIT_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
          />
          <NumberField
            label="Valor do limite"
            value={amount}
            onChange={setAmount}
            prefix="R$"
            min={0}
            step={10}
          />
          <Button className="w-full" onClick={save}>
            Criar limite
          </Button>
        </div>
      </BottomSheetContent>
    </Sheet>
  );
}
