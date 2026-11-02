import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { requireModule } from "@/lib/admin/modules";
import { AdminPage, Bars, Card, Loading, Stat, StatGrid } from "@/components/admin/kit";
import { useAdminData } from "@/components/admin/hooks";
import { formatCount, formatRate, rate } from "@/lib/calc/business";

export const Route = createFileRoute("/_authenticated/admin/uso")({
  beforeLoad: ({ context }) => requireModule(context.staff, "/admin/uso"),
  head: () => pageHead("Uso das funcionalidades", "O que as pessoas usam e o que abandonam, em números agregados.", "Uso das funcionalidades."),
  component: Usage,
});

type Usage = {
  people: number | null;
  active_7d: number | null;
  active_30d: number | null;
  inactive_30d: number | null;
  features: Record<string, number | null>;
  events_30d: Record<string, number | null>;
};

const FEATURE: Record<string, string> = {
  plano: "Plano de aposentadoria",
  lancamentos: "Lançamentos (alguma vez)",
  lancamentos_30d: "Lançamentos (últimos 30 dias)",
  orcamento: "Orçamento",
  patrimonio: "Patrimônio",
  metas: "Metas",
  carteira: "Carteira de investimentos",
  aportes: "Aportes registrados",
};
const AREA: Record<string, string> = {
  inicio: "Início",
  lancamentos: "Lançamentos",
  orcamento: "Orçamento",
  contas: "Contas",
  plano: "Plano",
  patrimonio: "Patrimônio",
  progresso: "Progresso",
  fechamento: "Fechamento do mês",
};

function Usage() {
  const { data: u, failed, reload } = useAdminData<Usage>(() => supabase.rpc("admin_feature_usage"), []);
  const pct = (n: number | null) => (n === null || u?.people == null ? "" : ` (${formatRate(rate(n, u.people))})`);
  return (
    <AdminPage
      title="Uso das funcionalidades"
      intro="Só contagens de pessoas, nunca valores: ninguém da equipe vê patrimônio, lançamentos ou metas de uma pessoa. Grupos com menos de 5 pessoas aparecem como “<5”."
    >
      {!u ? (
        <Loading failed={failed} onRetry={reload} />
      ) : (
        <>
          <StatGrid>
            <Stat label="Contas com dados" value={formatCount(u.people)} />
            <Stat label="Ativas em 7 dias" value={formatCount(u.active_7d)} note="Salvaram algo na semana" />
            <Stat label="Ativas em 30 dias" value={formatCount(u.active_30d)} />
            <Stat label="Paradas há 30+ dias" value={formatCount(u.inactive_30d)} note="Possível abandono" alert={(u.inactive_30d ?? 0) > (u.active_30d ?? 0)} />
          </StatGrid>
          <Card title="Quantas contas usam cada área" note="A partir do que cada conta salvou (sim ou não, sem valores)">
            <Bars rows={Object.entries(FEATURE).map(([k, label]) => ({ label: `${label}${pct(u.features[k] ?? null)}`, value: u.features[k] ?? null }))} total={u.people ?? undefined} />
          </Card>
          <Card title="Áreas abertas nos últimos 30 dias" note="Pessoas distintas, só de quem aceitou a medição">
            <Bars rows={Object.entries(u.events_30d).map(([k, v]) => ({ label: AREA[k] ?? k, value: v }))} />
          </Card>
        </>
      )}
    </AdminPage>
  );
}
