import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { requireModule } from "@/lib/admin/modules";
import { adminReconcile } from "@/lib/admin/panel.functions";
import type { ReconcileIssue } from "@/lib/admin/reconcile";
import { AdminPage, Bars, Card, Loading, PeriodPicker, STATUS_PILL, Stat, StatGrid, Table } from "@/components/admin/kit";
import { daysAgo, useAdminData, useCanWrite, type Period } from "@/components/admin/hooks";
import { Button } from "@/components/ui/button";
import { churn, formatRate } from "@/lib/calc/business";
import { formatMoney } from "@/lib/calc/format";
import { formatDate } from "@/lib/labels";
import { PLAN_NAMES, type PaidPlan } from "@/lib/billing/catalog";
import { errMsg } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/admin/assinaturas")({
  beforeLoad: ({ context }) => requireModule(context.staff, "/admin/assinaturas"),
  head: () => pageHead("Assinaturas e faturamento", "Assinantes, receita, pagamentos e conciliação.", "Assinaturas e faturamento."),
  component: Billing,
});

type BillingData = {
  by_plan: { plan: string; period: string; status: string; n: number }[];
  active_subscribers: number;
  registered_without_subscription: number;
  mrr_cents: number;
  revenue_cents: number;
  payments_by_status: Record<string, number>;
  renewals: number;
  first_payments: number;
  cancellations: number;
  active_at_start: number;
  recent_payments: { id: string; email: string | null; status: string; amount_cents: number; plan: string | null; period: string | null; at: string }[];
};

/** Status do Mercado Pago em português. */
const PAYMENT_STATUS: Record<string, string> = {
  approved: "Aprovado",
  pending: "Pendente",
  in_process: "Em análise",
  authorized: "Autorizado",
  rejected: "Recusado",
  cancelled: "Cancelado",
  refunded: "Estornado",
  charged_back: "Contestado",
};
const SUB_STATUS: Record<string, string> = { authorized: "ativas", pending: "aguardando", paused: "pausadas", cancelled: "canceladas" };
const ISSUE: Record<ReconcileIssue["kind"], string> = {
  aprovado_sem_credito: "Pago e sem acesso",
  valor_diferente: "Valor diferente",
  status_diferente: "Status diferente",
  so_no_app: "Só no app",
};

function Billing() {
  const [period, setPeriod] = useState<Period>({ from: daysAgo(29), to: daysAgo(0) });
  const { data: b, failed, reload } = useAdminData<BillingData>(() => supabase.rpc("admin_billing", { p_from: period.from, p_to: period.to }), [period.from, period.to]);
  const canReconcile = useCanWrite("/admin/assinaturas");
  const run = useServerFn(adminReconcile);
  const [issues, setIssues] = useState<{ list: ReconcileIssue[]; checked: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function reconcile() {
    setBusy(true);
    try {
      const r = await run({ data: { from: period.from, to: period.to } });
      if (r.error) toast.error(r.error);
      else setIssues({ list: r.issues, checked: r.checked });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminPage
      title="Assinaturas e faturamento"
      intro="Não existe plano grátis: quem tem conta e não assina aparece como “cadastrado sem assinatura”. Valores em reais, como cobrados pelo Mercado Pago."
      actions={<PeriodPicker value={period} onChange={setPeriod} />}
    >
      {!b ? (
        <Loading failed={failed} onRetry={reload} />
      ) : (
        <>
          <StatGrid>
            <Stat label="Assinantes ativos" value={b.active_subscribers.toLocaleString("pt-BR")} note={`${b.registered_without_subscription.toLocaleString("pt-BR")} cadastrados sem assinatura`} />
            <Stat label="Receita recorrente (MRR)" value={formatMoney(b.mrr_cents)} note="Anuais divididos por 12" />
            <Stat label="Recebido no período" value={formatMoney(b.revenue_cents)} note={`${b.first_payments} primeiro(s) pagamento(s) · ${b.renewals} renovação(ões)`} />
            <Stat label="Cancelamentos" value={String(b.cancellations)} note={`Churn: ${formatRate(churn(b.cancellations, b.active_at_start))} dos ativos no início`} />
          </StatGrid>

          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Assinaturas por plano" note="Situação atual de cada assinatura no Mercado Pago">
              <Bars
                rows={b.by_plan.map((r) => ({
                  label: `${PLAN_NAMES[r.plan as PaidPlan] ?? r.plan} ${r.period} · ${SUB_STATUS[r.status] ?? r.status}`,
                  value: r.n,
                }))}
              />
            </Card>
            <Card title="Pagamentos no período" note="Todos os pagamentos que o Mercado Pago avisou, aprovados ou não">
              <Bars rows={Object.entries(b.payments_by_status).map(([s, n]) => ({ label: PAYMENT_STATUS[s] ?? s, value: n }))} />
            </Card>
          </div>

          <Card title="Últimos pagamentos">
            <Table
              head={["Data", "Conta", "Plano", "Valor", "Status"]}
              rows={b.recent_payments.map((p) => [
                formatDate(p.at),
                <span key="e" className="break-all">{p.email ?? "—"}</span>,
                p.plan ? `${PLAN_NAMES[p.plan as PaidPlan] ?? p.plan} ${p.period ?? ""}` : "—",
                <span key="v" className="money">{formatMoney(p.amount_cents)}</span>,
                <span key="s" className={STATUS_PILL}>{PAYMENT_STATUS[p.status] ?? p.status}</span>,
              ])}
              empty="Nenhum pagamento registrado ainda."
            />
          </Card>

          <Card title="Conciliação com o Mercado Pago" note="Compara os pagamentos do período no Mercado Pago com os do app e mostra só o que não bate.">
            {canReconcile ? (
              <Button variant="outline" disabled={busy} onClick={reconcile}>
                {busy ? "Conferindo…" : "Conferir o período"}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">Só o financeiro roda a conciliação.</p>
            )}
            {issues && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  {issues.checked} pagamento(s) conferido(s) no Mercado Pago. {issues.list.length ? `${issues.list.length} divergência(s):` : "Tudo bate."}
                </p>
                {issues.list.length > 0 && (
                  <Table
                    head={["Pagamento", "Problema", "Detalhe"]}
                    rows={issues.list.map((i) => [<code key="i" className="text-xs">{i.id}</code>, <span key="k" className={STATUS_PILL}>{ISSUE[i.kind]}</span>, i.detail])}
                  />
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </AdminPage>
  );
}
