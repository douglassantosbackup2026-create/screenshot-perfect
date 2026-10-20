import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { compoundVsSimple, purchasingPower, savingsOverYears } from "@/lib/calc/lessons";
import { formatMonthly, formatWealth } from "@/lib/calc/format";
import type { LessonWidget as Kind } from "@/content/journey";

/** Mini simulação dentro da lição: a pessoa mexe e vê o efeito. Os números vêm do motor de cálculo. */
export function LessonWidget({ kind }: { kind: Kind }) {
  const [years, setYears] = useState(kind === "inflacao" ? 10 : 20);
  const range = kind === "inflacao" ? { min: 1, max: 30 } : { min: 5, max: 40 };

  let headline: string;
  let detail: string;
  if (kind === "tempo") {
    const r = savingsOverYears(500, 0.04, years);
    headline = formatWealth(r.value);
    detail = `R$ 500 por mês durante ${years} anos, com retorno real de 4% ao ano. Você aportaria ${formatWealth(r.contributed)}; o resto vem dos rendimentos.`;
  } else if (kind === "inflacao") {
    const v = purchasingPower(1000, 0.04, years);
    headline = formatMonthly(v);
    detail = `É o que R$ 1.000 de hoje compram daqui a ${years} ${years === 1 ? "ano" : "anos"}, com inflação de 4% ao ano.`;
  } else {
    const r = compoundVsSimple(10000, 0.06, years);
    headline = formatWealth(r.compound);
    detail = `R$ 10 mil a 6% ao ano por ${years} anos com juros compostos. Com juros simples seriam ${formatWealth(r.simple)}.`;
  }

  return (
    <section className="mt-8 rounded-2xl bg-card p-5 shadow-card" aria-label="Simule">
      <p className="eyebrow">Simule</p>
      <p className="money mt-2 font-display text-3xl font-semibold text-primary" aria-live="polite">
        {headline}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      <Slider
        className="mt-5"
        min={range.min}
        max={range.max}
        step={1}
        value={[years]}
        onValueChange={(v) => setYears(v[0] ?? years)}
        aria-label="Anos"
      />
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{range.min} anos</span>
        <span>{range.max} anos</span>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Exemplo ilustrativo com premissas fixas, não uma previsão.</p>
    </section>
  );
}
