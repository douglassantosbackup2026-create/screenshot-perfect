import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { requireModule } from "@/lib/admin/modules";
import { AdminPage, Card, Loading } from "@/components/admin/kit";
import { useAdminData, useCanWrite } from "@/components/admin/hooks";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/forms";
import { assumptionsFrom, fetchCalcSettings, type CalcSettingsRow } from "@/lib/data/calc-assumptions";
import { simulate, validateInputs, type PlanInputs } from "@/lib/calc/retirement";
import { formatMonthly, formatWealth } from "@/lib/calc/format";
import { formatDate } from "@/lib/labels";
import { errMsg } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/admin/calculadora")({
  beforeLoad: ({ context }) => requireModule(context.staff, "/admin/calculadora"),
  head: () => pageHead("Calculadora", "Premissas financeiras da calculadora.", "Premissas da calculadora."),
  component: CalcSettings,
});

/** Pessoa de exemplo para a prévia: 30 anos, quer R$ 8.000 aos 60, começando do zero. */
const EXAMPLE = { currentAge: 30, retirementAge: 60, initialWealth: 0, monthlyContribution: 0, desiredMonthlyIncome: 8000, inssEstimate: null };

const pct = (v: number) => Math.round(v * 10000) / 100;

function CalcSettings() {
  const canWrite = useCanWrite("/admin/calculadora");
  const { data: row, reload, failed } = useAdminData<CalcSettingsRow | null>(async () => ({ data: await fetchCalcSettings(), error: null }), []);
  const [form, setForm] = useState<Record<string, number | null> | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!row) return;
    setForm({
      return_conservador: pct(Number(row.return_conservador)),
      return_central: pct(Number(row.return_central)),
      return_otimista: pct(Number(row.return_otimista)),
      inflation: pct(Number(row.inflation)),
      horizon: Number(row.horizon),
      costs: pct(Number(row.costs)),
    });
  }, [row]);

  if (!row || !form) return <AdminPage title="Calculadora"><Loading failed={failed} onRetry={reload} /></AdminPage>;

  const next = {
    return_conservador: (form["return_conservador"] ?? 0) / 100,
    return_central: (form["return_central"] ?? 0) / 100,
    return_otimista: (form["return_otimista"] ?? 0) / 100,
    inflation: (form["inflation"] ?? 0) / 100,
    horizon: form["horizon"] ?? 0,
    costs: (form["costs"] ?? 0) / 100,
  };
  const before = assumptionsFrom(row);
  const after = assumptionsFrom({ ...next, updated_at: row.updated_at });
  const inputsBefore: PlanInputs = { ...before, ...EXAMPLE };
  const inputsAfter: PlanInputs = { ...after, ...EXAMPLE };
  const errors = validateInputs(inputsAfter);
  if (!(next.return_conservador <= next.return_central && next.return_central <= next.return_otimista))
    errors.push("Os retornos precisam crescer do conservador ao otimista.");
  if (!(next.horizon >= 70 && next.horizon <= 120)) errors.push("Use um horizonte entre 70 e 120 anos.");
  const a = simulate(inputsBefore, "central", false);
  const b = errors.length ? null : simulate(inputsAfter, "central", false);
  const dirty = JSON.stringify(after) !== JSON.stringify(before);
  const set = (k: string) => (v: number | null) => setForm((f) => ({ ...f!, [k]: v }));

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_calc_settings", { p: next as unknown as Json });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("Premissas salvas. Valem a partir de agora na página inicial, na calculadora e em planos novos.");
    reload();
  }

  return (
    <AdminPage
      title="Calculadora"
      intro="Premissas usadas na página inicial e na calculadora completa. Planos já salvos guardam as próprias premissas e não mudam. Retornos são reais (acima da inflação)."
    >
      <Card title="Premissas" note={`Alteradas em ${formatDate(row.updated_at)}. Só o super admin altera.`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField label="Conservador" value={form["return_conservador"] ?? null} onChange={set("return_conservador")} suffix="% a.a." step={0.5} />
          <NumberField label="Central" value={form["return_central"] ?? null} onChange={set("return_central")} suffix="% a.a." step={0.5} />
          <NumberField label="Otimista" value={form["return_otimista"] ?? null} onChange={set("return_otimista")} suffix="% a.a." step={0.5} />
          <NumberField label="Inflação" value={form["inflation"] ?? null} onChange={set("inflation")} suffix="% a.a." step={0.5} />
          <NumberField label="Horizonte" value={form["horizon"] ?? null} onChange={set("horizon")} suffix="anos" />
          <NumberField label="Custos" value={form["costs"] ?? null} onChange={set("costs")} suffix="% a.a." step={0.1} />
        </div>
        {errors.length > 0 && <p className="mt-3 text-sm text-destructive">{errors[0]}</p>}
      </Card>
      <Card title="Prévia com uma pessoa de exemplo" note="30 anos, quer R$ 8.000 por mês aos 60, começando do zero, cenário central">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Aporte necessário hoje</dt>
          <dd className="money">{formatMonthly(a.requiredMonthlyContribution)}/mês</dd>
          <dt className="text-muted-foreground">Com as premissas novas</dt>
          <dd className="money text-primary">{b ? `${formatMonthly(b.requiredMonthlyContribution)}/mês` : "—"}</dd>
          <dt className="text-muted-foreground">Patrimônio-alvo hoje</dt>
          <dd className="money">{formatWealth(a.targetWealth)}</dd>
          <dt className="text-muted-foreground">Com as premissas novas</dt>
          <dd className="money text-primary">{b ? formatWealth(b.targetWealth) : "—"}</dd>
        </dl>
      </Card>
      {canWrite && (
        <Button disabled={!dirty || busy || errors.length > 0} onClick={save}>
          Salvar premissas
        </Button>
      )}
    </AdminPage>
  );
}
