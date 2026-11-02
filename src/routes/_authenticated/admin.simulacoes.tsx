import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { requireModule } from "@/lib/admin/modules";
import { AdminPage, Bars, Card, DailyChart, Loading, PeriodPicker, Stat, StatGrid } from "@/components/admin/kit";
import { daysAgo, useAdminData, type Period } from "@/components/admin/hooks";
import { AGE_BANDS, INCOME_BANDS, MONTHLY_BANDS, formatRate, rate } from "@/lib/calc/business";

export const Route = createFileRoute("/_authenticated/admin/simulacoes")({
  beforeLoad: ({ context }) => requireModule(context.staff, "/admin/simulacoes"),
  head: () => pageHead("Simulações", "Uso e resultados da calculadora.", "Simulações da calculadora."),
  component: Simulations,
});

type Sims = {
  series: { day: string; started: number; completed: number }[];
  age_bands: Record<string, number | null>;
  income_bands: Record<string, number | null>;
  monthly_bands: Record<string, number | null>;
  by_source: Record<string, number | null>;
  by_page: Record<string, number | null>;
};

const ordered = (bands: string[], counts: Record<string, number | null>) =>
  bands.filter((b) => b in counts).map((b) => ({ label: b, value: counts[b] ?? null }));
const PAGE: Record<string, string> = { "/": "Página inicial", "/calculadora": "Calculadora completa" };

function Simulations() {
  const [period, setPeriod] = useState<Period>({ from: daysAgo(29), to: daysAgo(0) });
  const { data: s, failed, reload } = useAdminData<Sims>(() => supabase.rpc("admin_simulations", { p_from: period.from, p_to: period.to }), [period.from, period.to]);
  const started = s?.series.reduce((t, d) => t + Number(d.started), 0) ?? 0;
  const completed = s?.series.reduce((t, d) => t + Number(d.completed), 0) ?? 0;

  return (
    <AdminPage
      title="Simulações"
      intro="Iniciada: a pessoa mexeu num campo. Concluída: apareceu um resultado válido depois disso. Cada uma conta uma vez por página aberta. As faixas vêm só de quem aceitou a medição; o número digitado nunca sai do navegador."
      actions={<PeriodPicker value={period} onChange={setPeriod} />}
    >
      {!s ? (
        <Loading failed={failed} onRetry={reload} />
      ) : (
        <>
          <StatGrid>
            <Stat label="Iniciadas" value={started.toLocaleString("pt-BR")} note="Contagem anônima" />
            <Stat label="Concluídas" value={completed.toLocaleString("pt-BR")} note="Contagem anônima" />
            <Stat label="Taxa de conclusão" value={formatRate(rate(completed, started))} />
            <Stat label="Abandonadas" value={Math.max(started - completed, 0).toLocaleString("pt-BR")} note="Iniciadas sem resultado" />
          </StatGrid>
          <Card title="Simulações concluídas por dia" note="Contagem anônima">
            <DailyChart rows={s.series} field="completed" label="Concluídas" />
          </Card>
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Idade de quem simula" note="Só de quem aceitou a medição">
              <Bars rows={ordered(AGE_BANDS, s.age_bands)} />
            </Card>
            <Card title="Renda desejada" note="Só de quem aceitou a medição">
              <Bars rows={ordered(INCOME_BANDS, s.income_bands)} />
            </Card>
            <Card title="Aporte mensal calculado" note="Resultado que a calculadora mostrou, em faixas">
              <Bars rows={ordered(MONTHLY_BANDS, s.monthly_bands)} />
            </Card>
            <Card title="Onde e de onde" note="Página da calculadora e origem da visita (UTM)">
              <Bars rows={[...Object.entries(s.by_page).map(([k, v]) => ({ label: PAGE[k] ?? k, value: v })), ...Object.entries(s.by_source).map(([k, v]) => ({ label: `Origem: ${k}`, value: v }))]} />
            </Card>
          </div>
        </>
      )}
    </AdminPage>
  );
}
