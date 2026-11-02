import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { requireModule } from "@/lib/admin/modules";
import { AdminPage, Bars, Card, Loading, PeriodPicker, Stat, StatGrid, Table } from "@/components/admin/kit";
import { daysAgo, useAdminData, type Period } from "@/components/admin/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRate, rate } from "@/lib/calc/business";

export const Route = createFileRoute("/_authenticated/admin/marketing")({
  beforeLoad: ({ context }) => requireModule(context.staff, "/admin/marketing"),
  head: () => pageHead("Marketing", "Campanhas, UTMs e eventos.", "Marketing."),
  component: Marketing,
});

type Mkt = {
  campaigns: { source: string; campaign: string; visitors: number; simulations: number; leads: number; signups: number; checkouts: number; subscriptions: number }[];
  leads_by_source: Record<string, number>;
  events: Record<string, number>;
  consent: { aceito: number; recusado: number };
};

const EVENT: Record<string, string> = {
  landing_view: "Visitou a página inicial",
  session_start: "Sessões",
  calculator_started: "Começou uma simulação",
  calculator_completed: "Concluiu uma simulação",
  calculator_used: "Usou a calculadora completa",
  lead_saved: "Deixou o e-mail",
  signup_completed: "Criou conta",
  checkout_started: "Abriu o pagamento",
  subscription_authorized: "Assinou",
  feature_used: "Abriu uma área do app",
};

function Marketing() {
  const [period, setPeriod] = useState<Period>({ from: daysAgo(29), to: daysAgo(0) });
  const { data: m, failed, reload } = useAdminData<Mkt>(() => supabase.rpc("admin_marketing", { p_from: period.from, p_to: period.to }), [period.from, period.to]);
  const consentTotal = m ? m.consent.aceito + m.consent.recusado : 0;

  return (
    <AdminPage
      title="Marketing"
      intro="Campanhas pela origem da visita (utm_source / utm_campaign). Esses números são só de quem aceitou a medição; os totais anônimos estão na Visão geral."
      actions={<PeriodPicker value={period} onChange={setPeriod} />}
    >
      {!m ? (
        <Loading failed={failed} onRetry={reload} />
      ) : (
        <>
          <StatGrid>
            <Stat label="Aceitaram a medição" value={m.consent.aceito.toLocaleString("pt-BR")} note={`${formatRate(rate(m.consent.aceito, consentTotal))} de quem respondeu ao aviso`} />
            <Stat label="Recusaram" value={m.consent.recusado.toLocaleString("pt-BR")} />
            <Stat label="Campanhas com visitas" value={String(m.campaigns.filter((c) => c.campaign !== "—").length)} />
            <Stat label="Leads no período" value={Object.values(m.leads_by_source).reduce((a, b) => a + b, 0).toLocaleString("pt-BR")} />
          </StatGrid>
          <Card title="Campanhas" note="Visitantes distintos e conversões por origem e campanha">
            <Table
              head={["Origem", "Campanha", "Visitantes", "Simulações", "Leads", "Cadastros", "Assinaturas", "Conversão"]}
              rows={m.campaigns.map((c) => [
                c.source,
                c.campaign,
                c.visitors,
                c.simulations,
                c.leads,
                c.signups,
                c.subscriptions,
                formatRate(rate(c.subscriptions, c.visitors)),
              ])}
              empty="Nenhum evento com origem no período."
            />
          </Card>
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Leads por origem">
              <Bars rows={Object.entries(m.leads_by_source).map(([k, v]) => ({ label: k, value: v }))} />
            </Card>
            <Card title="Eventos no período">
              <Bars rows={Object.entries(m.events).map(([k, v]) => ({ label: EVENT[k] ?? k, value: v }))} />
            </Card>
          </div>
          <UtmBuilder />
        </>
      )}
    </AdminPage>
  );
}

/** Monta links com UTM (só na tela; nada é gravado). */
function UtmBuilder() {
  const [page, setPage] = useState("/");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const clean = (v: string) => v.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 100);
  const params = new URLSearchParams();
  if (source) params.set("utm_source", clean(source));
  if (medium) params.set("utm_medium", clean(medium));
  if (campaign) params.set("utm_campaign", clean(campaign));
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const link = `${origin}${page.startsWith("/") ? page : `/${page}`}${params.size ? `?${params}` : ""}`;

  return (
    <Card title="Gerar link de campanha">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input className="h-11" aria-label="Página" placeholder="Página (ex.: /calculadora)" value={page} onChange={(e) => setPage(e.target.value)} />
        <Input className="h-11" aria-label="Origem" placeholder="Origem (ex.: instagram)" value={source} onChange={(e) => setSource(e.target.value)} />
        <Input className="h-11" aria-label="Mídia" placeholder="Mídia (ex.: stories)" value={medium} onChange={(e) => setMedium(e.target.value)} />
        <Input className="h-11" aria-label="Campanha" placeholder="Campanha (ex.: black-friday)" value={campaign} onChange={(e) => setCampaign(e.target.value)} />
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted p-2">
        <code className="min-w-0 flex-1 truncate text-xs">{link}</code>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Copiar link"
          onClick={() =>
            void navigator.clipboard.writeText(link).then(
              () => toast.success("Link copiado."),
              () => toast.error("Não foi possível copiar."),
            )
          }
        >
          <Copy size={16} />
        </Button>
      </div>
    </Card>
  );
}
