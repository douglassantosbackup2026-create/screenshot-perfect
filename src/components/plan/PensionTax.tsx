// "PGBL ou VGBL?": calculadora educativa da tributação da previdência. Toda conta vem de src/lib/calc/pensionTax.ts.
import { useState } from "react";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NumberField, Segmented } from "@/components/forms";
import {
  compareRegimes,
  MARGINAL_RATES,
  pensionTaxDefaults,
  validatePensionTax,
  type PensionTaxComparison,
  type PensionTaxInput,
} from "@/lib/calc/pensionTax";
import type { PlanInputs } from "@/lib/calc/retirement";
import { formatPercent, formatWealth } from "@/lib/calc/format";
import { cn } from "@/lib/utils";

const WHY: Record<PensionTaxComparison["why"], string> = {
  sem_deducao:
    "Sem a declaração completa do IR, o PGBL não abate nada e ainda cobra imposto sobre o total no resgate. Para quem declara no modelo simplificado, como muitos MEIs e PJs no Simples, o VGBL costuma ser o caminho.",
  restituicao_compensa:
    "A restituição de cada ano, reinvestida, rende mais do que o imposto sobre o total cobra no resgate. Vale aportar no PGBL até 12% da renda tributável e o resto no VGBL.",
  imposto_no_total_pesa:
    "Neste prazo, o imposto sobre o total no resgate pesa mais do que a restituição. Prazos curtos ou alíquota alta no resgate favorecem o VGBL.",
  diferenca_pequena:
    "A diferença é pequena. Vale escolher pela flexibilidade: o VGBL tributa só o rendimento se você precisar resgatar antes.",
};

export function PensionTaxCard({ inputs }: { inputs: PlanInputs }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-4 rounded-2xl bg-card p-5 shadow-card" aria-label="PGBL ou VGBL">
      <h2 className="flex items-center gap-2 text-base">
        <Scale size={18} className="text-primary" aria-hidden /> PGBL ou VGBL?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Depende de como você declara o IR e de quanto tempo o dinheiro fica aplicado. Compare com os
        seus números.
      </p>
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        Comparar
      </Button>
      <PensionTaxSheet inputs={inputs} open={open} onOpenChange={setOpen} />
    </section>
  );
}

function PensionTaxSheet({
  inputs,
  open,
  onOpenChange,
}: {
  inputs: PlanInputs;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const d = pensionTaxDefaults(inputs);
  const [annual, setAnnual] = useState<number | null>(d.annualContribution || 12000);
  const [years, setYears] = useState<number | null>(d.years);
  const [complete, setComplete] = useState(true);
  const [income, setIncome] = useState<number | null>(100000);
  const [marginal, setMarginal] = useState("0.275");
  const [regime, setRegime] = useState<PensionTaxInput["regime"]>("regressiva");
  const [progressivePct, setProgressivePct] = useState<number | null>(7.5);

  const input: PensionTaxInput = {
    annualContribution: annual ?? 0,
    years: years ?? 0,
    realReturn: d.realReturn,
    completeReturn: complete,
    taxableIncome: income ?? 0,
    marginalRate: Number(marginal),
    regime,
    progressiveRate: (progressivePct ?? 0) / 100,
  };
  const errors = validatePensionTax(input);
  const r = errors.length ? null : compareRegimes(input);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-3xl sm:mx-auto sm:max-w-2xl"
      >
        <SheetHeader className="text-left">
          <SheetTitle>PGBL ou VGBL?</SheetTitle>
          <SheetDescription>
            Em valores de hoje, com o retorno real do cenário central do seu plano (
            {formatPercent(d.realReturn)} ao ano).
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <NumberField
            label="Aporte por ano"
            value={annual}
            onChange={setAnnual}
            prefix="R$"
            min={0}
          />
          <NumberField
            label="Anos até o resgate"
            value={years}
            onChange={setYears}
            min={1}
            max={60}
            step={1}
          />
          <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-muted px-4 sm:col-span-2">
            <span className="text-sm">Faço a declaração completa do IR</span>
            <Switch checked={complete} onCheckedChange={setComplete} />
          </label>
          {complete && (
            <>
              <NumberField
                label="Renda bruta tributável por ano"
                value={income}
                onChange={setIncome}
                prefix="R$"
                min={0}
              />
              <Segmented
                label="Alíquota do IR hoje"
                value={marginal}
                onChange={setMarginal}
                options={MARGINAL_RATES.map((m) => ({ value: String(m), label: formatPercent(m) }))}
              />
            </>
          )}
          <div className="sm:col-span-2">
            <Segmented
              label="Tabela no resgate"
              value={regime}
              onChange={setRegime}
              options={[
                { value: "regressiva", label: "Regressiva" },
                { value: "progressiva", label: "Progressiva" },
              ]}
            />
          </div>
          {regime === "progressiva" && (
            <NumberField
              label="Alíquota efetiva esperada no resgate"
              value={progressivePct}
              onChange={setProgressivePct}
              suffix="%"
              min={0}
              max={27.5}
              step={0.5}
            />
          )}
        </div>

        {errors.length > 0 && <p className="mt-4 text-sm text-destructive">{errors[0]}</p>}

        {r && (
          <>
            <table className="mt-6 w-full text-sm" aria-live="polite">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="py-2 text-left font-normal">
                    <span className="sr-only">Indicador</span>
                  </th>
                  <th className="py-2 text-right font-semibold">Só VGBL</th>
                  <th className="py-2 text-right font-semibold">PGBL até 12% + VGBL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2.5 text-muted-foreground">Acumulado</td>
                  <td className="money py-2.5 text-right">{formatWealth(r.vgbl.gross)}</td>
                  <td className="money py-2.5 text-right">{formatWealth(r.pgbl.gross)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-muted-foreground">IR no resgate</td>
                  <td className="money py-2.5 text-right">{formatWealth(r.vgbl.tax)}</td>
                  <td className="money py-2.5 text-right">{formatWealth(r.pgbl.tax)}</td>
                </tr>
                <tr>
                  <td className="py-2.5 text-muted-foreground">Fica com você</td>
                  <td
                    className={cn(
                      "money py-2.5 text-right font-semibold",
                      r.winner === "vgbl" && "text-primary",
                    )}
                  >
                    {formatWealth(r.vgbl.net)}
                  </td>
                  <td
                    className={cn(
                      "money py-2.5 text-right font-semibold",
                      r.winner === "pgbl" && "text-primary",
                    )}
                  >
                    {formatWealth(r.pgbl.net)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-sm">
              <span className="font-semibold">
                {r.winner === "empate" ? "Empate." : r.winner === "pgbl" ? "PGBL + VGBL." : "VGBL."}
              </span>{" "}
              {WHY[r.why]}
            </p>
            {r.deductible > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                No PGBL, até <span className="money">{formatWealth(r.deductible)}</span> por ano
                (12% da renda tributável); a restituição estimada é de{" "}
                <span className="money">{formatWealth(r.refundPerYear)}</span>, reinvestida no ano
                seguinte.
              </p>
            )}
          </>
        )}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Calculadora educativa com valores de referência (tabela regressiva da Lei 11.053/2004 e
          limite de 12% da renda tributável). Não considera taxas do plano nem mudanças futuras nas
          regras. Confirme com um contador antes de decidir.
        </p>
      </SheetContent>
    </Sheet>
  );
}
