// "E se…?": mexe nas premissas num rascunho e compara com o plano salvo, lado a lado.
// Nada muda no plano até a pessoa escolher "Salvar no plano". Toda conta vem de src/lib/calc.
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  scenarioDelta,
  simulate,
  validateInputs,
  type PlanInputs,
  type ScenarioKey,
} from "@/lib/calc/retirement";
import { formatAge, formatMonthly, formatPercent, formatWealth } from "@/lib/calc/format";

type LeverKey = "monthlyContribution" | "retirementAge" | "desiredMonthlyIncome" | "returnShift";
type Lever = {
  key: LeverKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
};

const pp = (v: number) =>
  `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`;
const roundUp = (v: number, to: number) => Math.ceil(v / to) * to;

export function WhatIfSheet({
  base,
  scenario,
  includeInss,
  open,
  onOpenChange,
  onSave,
}: {
  base: PlanInputs;
  scenario: ScenarioKey;
  includeInss: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (inputs: PlanInputs) => void;
}) {
  const [variant, setVariant] = useState<PlanInputs>(base);
  const [shift, setShift] = useState(0); // p.p. somados ao retorno real de todos os cenários

  // Recomeça do plano quando ele muda de verdade (o store recria o objeto a cada gravação).
  const baseKey = JSON.stringify(base);
  useEffect(() => {
    setVariant(base);
    setShift(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey]);

  const levers: Lever[] = [
    {
      key: "monthlyContribution",
      label: "Aporte mensal",
      min: 0,
      max: Math.max(5000, roundUp(base.monthlyContribution * 3, 100)),
      step: 50,
      format: formatMonthly,
    },
    {
      key: "retirementAge",
      label: "Aposentar aos",
      min: base.currentAge + 1,
      max: base.horizonAge - 1,
      step: 1,
      format: (v) => `${v} anos`,
    },
    {
      key: "desiredMonthlyIncome",
      label: "Renda desejada",
      min: 500,
      max: Math.max(20000, roundUp(base.desiredMonthlyIncome * 2, 500)),
      step: 100,
      format: formatMonthly,
    },
    {
      key: "returnShift",
      label: "Retorno real (todos os cenários)",
      min: -3,
      max: 3,
      step: 0.5,
      format: pp,
    },
  ];

  const inputs = useMemo<PlanInputs>(
    () => ({
      ...variant,
      returns: {
        conservador: base.returns.conservador + shift / 100,
        central: base.returns.central + shift / 100,
        otimista: base.returns.otimista + shift / 100,
      },
    }),
    [variant, shift, base.returns],
  );
  const errors = validateInputs(inputs);
  const adjusted = shift !== 0 || JSON.stringify(variant) !== JSON.stringify(base);
  const b = simulate(base, scenario, includeInss);
  const v = errors.length ? null : simulate(inputs, scenario, includeInss);
  const d = v ? scenarioDelta(b, v) : null;

  const valueOf = (key: LeverKey, from: PlanInputs, s: number) =>
    key === "returnShift" ? s : from[key];
  function setLever(l: Lever, value: number) {
    const clamped = Math.min(l.max, Math.max(l.min, value));
    if (l.key === "returnShift") setShift(clamped);
    else setVariant((x) => ({ ...x, [l.key]: clamped }));
  }
  function restore() {
    setVariant(base);
    setShift(0);
  }

  // better: true quando o "E se" melhora o número; null quando não mudou ou não há direção boa.
  const dir = (delta: number, higherIsBetter: boolean) =>
    Math.abs(delta) < 1e-6 ? null : higherIsBetter ? delta > 0 : delta < 0;
  const rows =
    v && d
      ? [
          {
            label: "Aporte necessário",
            base: formatMonthly(b.requiredMonthlyContribution),
            variant: formatMonthly(v.requiredMonthlyContribution),
            better: dir(d.requiredMonthlyContribution, false),
          },
          {
            label: "Patrimônio na aposentadoria",
            base: formatWealth(b.projectedWealthAtRetirement),
            variant: formatWealth(v.projectedWealthAtRetirement),
            better: dir(d.projectedWealthAtRetirement, true),
          },
          {
            label: "Renda que ele sustenta",
            base: formatMonthly(b.sustainableMonthlyIncome),
            variant: formatMonthly(v.sustainableMonthlyIncome),
            better: dir(d.sustainableMonthlyIncome, true),
          },
          {
            label: "Rumo à independência",
            base: formatPercent(b.coverageRatio),
            variant: formatPercent(v.coverageRatio),
            better: dir(d.coverageRatio, true),
          },
          {
            label: "O dinheiro dura até",
            base:
              b.depletionAge == null
                ? `${base.horizonAge} anos ou mais`
                : formatAge(b.depletionAge),
            variant:
              v.depletionAge == null
                ? `${inputs.horizonAge} anos ou mais`
                : formatAge(v.depletionAge),
            better: null,
          },
        ]
      : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] overflow-y-auto rounded-t-3xl sm:mx-auto sm:max-w-2xl"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            E se…?
            {adjusted && (
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                Ajustado
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            Teste mudanças sem alterar seu plano. Cenário {scenario},{" "}
            {includeInss ? "com INSS" : "sem INSS"}.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {levers.map((l) => {
            const value = valueOf(l.key, variant, shift);
            const planValue = valueOf(l.key, base, 0);
            return (
              <div key={l.key}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">{l.label}</p>
                    <p className="money font-semibold">
                      {l.format(value)}
                      {value !== planValue && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          plano: {l.format(planValue)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label={`Diminuir ${l.label.toLowerCase()}`}
                      onClick={() => setLever(l, value - l.step)}
                    >
                      <Minus size={16} aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label={`Aumentar ${l.label.toLowerCase()}`}
                      onClick={() => setLever(l, value + l.step)}
                    >
                      <Plus size={16} aria-hidden />
                    </Button>
                  </div>
                </div>
                <Slider
                  className="mt-3"
                  min={l.min}
                  max={l.max}
                  step={l.step}
                  value={[value]}
                  onValueChange={([x]) => setLever(l, x ?? value)}
                  aria-label={l.label}
                />
              </div>
            );
          })}
        </div>

        {errors.length > 0 && <p className="mt-4 text-sm text-destructive">{errors[0]}</p>}

        {rows.length > 0 && (
          <table className="mt-6 w-full text-sm" aria-live="polite">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="py-2 text-left font-normal">
                  <span className="sr-only">Indicador</span>
                </th>
                <th className="py-2 text-right font-semibold">Plano</th>
                <th className="py-2 text-right font-semibold">E se</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="py-2.5 text-muted-foreground">{r.label}</td>
                  <td className="money py-2.5 text-right">{r.base}</td>
                  <td
                    className={
                      "money py-2.5 text-right font-semibold " +
                      (r.better === true ? "text-primary" : "")
                    }
                  >
                    {r.variant}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={restore} disabled={!adjusted}>
            Restaurar
          </Button>
          <Button
            className="flex-1"
            disabled={!adjusted || errors.length > 0}
            onClick={() => onSave(inputs)}
          >
            Salvar no plano
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Ao salvar, a versão anterior do plano fica guardada no histórico.
        </p>
      </SheetContent>
    </Sheet>
  );
}
