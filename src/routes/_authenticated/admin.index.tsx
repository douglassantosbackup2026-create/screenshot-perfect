import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { requireModule, canRead } from "@/lib/admin/modules";
import { AdminPage, Bars, Card, DailyChart, Loading, PeriodPicker, Stat, StatGrid } from "@/components/admin/kit";
import { daysAgo, useAdminData, useStaff, type Period } from "@/components/admin/hooks";
import { delta, formatCount, formatRate, rate } from "@/lib/calc/business";
import { formatMoney } from "@/lib/calc/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  beforeLoad: ({ context }) => requireModule(context.staff, "/admin"),
  head: () => pageHead("Painel administrativo", "Crescimento, uso e oportunidades da plataforma.", "Visão geral do negócio."),
  component: Overview,
});

type Overview = {
  visits: number;
  visits_prev: number;
  sim_started: number;
  sim_completed: number;
  sim_completed_prev: number;
  unique_visitors: number;
  sessions: number;
  leads: number;
  leads_prev: number;
  signups: number;
  signups_prev: number;
  users_total: number;
  active_subscribers: number;
  courtesy_active?: number;
  mrr_cents: number;
  new_subscriptions: number;
  new_subscriptions_prev: number;
  cancellations: number;
  revenue_cents: number;
  payments_refused: number;
  active_7d: number | null;
  active_30d: number | null;
  incidents_open: number;
  tickets_open: number;
  tickets_waiting_24h: number;
  funnel: { sim_completed: number; leads: number; signups: number; subscriptions: number };
  series: { day: string; visits: number; sims: number; signups: number; leads: number }[];
};

const n = (v: number) => Number(v).toLocaleString("pt-BR");
const ANON = "Contagem anônima (todas as visitas)";
const CONSENT = "Só de quem aceitou a medição";

function Overview() {
  const staff = useStaff();
  const [period, setPeriod] = useState<Period>({ from: daysAgo(29), to: daysAgo(0) });
  const { data: o, failed, reload } = useAdminData<Overview>(() => supabase.rpc("admin_overview", { p_from: period.from, p_to: period.to }), [period.from, period.to]);

  const alerts = o
    ? [
        { show: o.incidents_open > 0, text: `${o.incidents_open} incidente(s) aberto(s)`, to: "/admin/monitoramento" as const },
        { show: o.payments_refused > 0, text: `${o.payments_refused} pagamento(s) recusado(s) no período`, to: "/admin/assinaturas" as const },
        { show: o.tickets_waiting_24h > 0, text: `${o.tickets_waiting_24h} chamado(s) sem resposta há mais de 24 h`, to: "/admin/atendimento" as const },
      ].filter((a) => a.show)
    : [];

  return (
    <AdminPage
      title="Visão geral"
      intro="A plataforma está crescendo, as pessoas estão usando e estamos gerando oportunidades? Cada número diz de onde vem."
      actions={<PeriodPicker value={period} onChange={setPeriod} />}
    >
      {!o ? (
        <Loading failed={failed} onRetry={reload} />
      ) : (
        <>
          {alerts.length > 0 && (
            <ul className="space-y-2" aria-label="Alertas">
              {alerts.map((a) => (
                <li key={a.text} className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 text-sm shadow-card ring-1 ring-destructive">
                  <AlertTriangle size={16} className="shrink-0 text-destructive" aria-hidden />
                  <span className="min-w-0 flex-1">{a.text}</span>
                  {canRead(staff, a.to) && (
                    <Link to={a.to} className="shrink-0 font-semibold text-primary">
                      Ver
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}

          <h2 className="text-lg">A plataforma está crescendo?</h2>
          <StatGrid>
            <Stat label="Visitas" value={n(o.visits)} delta={delta(o.visits, o.visits_prev)} note={ANON} />
            <Stat label="Cadastros" value={n(o.signups)} delta={delta(o.signups, o.signups_prev)} note={`${n(o.users_total)} contas no total`} />
            <Stat label="Assinantes ativos" value={n(o.active_subscribers)} note={`${n(o.new_subscriptions)} novos · ${n(o.cancellations)} cancelados no período${o.courtesy_active ? ` · +${n(o.courtesy_active)} com cortesia` : ""}`} />
            <Stat label="Receita recorrente (MRR)" value={formatMoney(o.mrr_cents)} note={`Recebido no período: ${formatMoney(o.revenue_cents)}`} />
          </StatGrid>
          <Card title="Visitas por dia" note={ANON}>
            <DailyChart rows={o.series} field="visits" label="Visitas" />
          </Card>

          <h2 className="text-lg">As pessoas estão usando?</h2>
          <StatGrid>
            <Stat label="Simulações iniciadas" value={n(o.sim_started)} note={ANON} />
            <Stat label="Simulações concluídas" value={n(o.sim_completed)} delta={delta(o.sim_completed, o.sim_completed_prev)} note={`Conclusão: ${formatRate(rate(o.sim_completed, o.sim_started))}`} />
            <Stat label="Ativos em 7 dias" value={formatCount(o.active_7d)} note="Contas que salvaram algo" />
            <Stat label="Ativos em 30 dias" value={formatCount(o.active_30d)} note="Contas que salvaram algo" />
          </StatGrid>
          <Card title="Simulações concluídas por dia" note={ANON}>
            <DailyChart rows={o.series} field="sims" label="Simulações concluídas" />
          </Card>

          <h2 className="text-lg">Estamos gerando oportunidades?</h2>
          <StatGrid>
            <Stat label="Leads" value={n(o.leads)} delta={delta(o.leads, o.leads_prev)} />
            <Stat label="Novas assinaturas" value={n(o.new_subscriptions)} delta={delta(o.new_subscriptions, o.new_subscriptions_prev)} />
            <Stat label="Visitantes únicos" value={n(o.unique_visitors)} note={CONSENT} />
            <Stat label="Sessões" value={n(o.sessions)} note={CONSENT} />
          </StatGrid>
          <Card
            title="Da simulação à assinatura"
            note="Totais do período em cada etapa. Etapas contadas por fontes diferentes: compare a ordem de grandeza, não pessoa a pessoa."
          >
            <Bars
              rows={[
                { label: "Simulações concluídas", value: o.funnel.sim_completed },
                { label: `Leads (${formatRate(rate(o.funnel.leads, o.funnel.sim_completed))})`, value: o.funnel.leads },
                { label: `Cadastros (${formatRate(rate(o.funnel.signups, o.funnel.sim_completed))})`, value: o.funnel.signups },
                { label: `Assinaturas (${formatRate(rate(o.funnel.subscriptions, o.funnel.signups))} dos cadastros)`, value: o.funnel.subscriptions },
              ]}
              total={Math.max(1, o.funnel.sim_completed, o.funnel.leads, o.funnel.signups, o.funnel.subscriptions)}
            />
          </Card>
          <p className="text-xs text-muted-foreground">
            Atendimento: {n(o.tickets_open)} chamado(s) em aberto. Números com menos de 5 pessoas aparecem como “&lt;5” para não identificar ninguém.
          </p>
        </>
      )}
    </AdminPage>
  );
}
