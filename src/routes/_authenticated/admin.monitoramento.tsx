import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { requireModule } from "@/lib/admin/modules";
import { AdminPage, Loading, STATUS_PILL, Stat, StatGrid } from "@/components/admin/kit";
import { useAdminData, useStaff } from "@/components/admin/hooks";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/labels";
import { errMsg } from "@/lib/errors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/monitoramento")({
  beforeLoad: ({ context }) => requireModule(context.staff, "/admin/monitoramento"),
  head: () => pageHead("Monitoramento", "Erros, falhas de salvamento, pagamentos e notificações.", "Monitoramento operacional."),
  component: Monitoring,
});

type Incident = {
  id: string;
  source: string;
  level: "aviso" | "erro" | "critico";
  message: string;
  path: string | null;
  count: number;
  first_at: string;
  last_at: string;
  status: "aberto" | "resolvido";
  resolved_at: string | null;
};

const SOURCE: Record<string, string> = {
  cliente: "Erro na tela",
  salvamento: "Falha ao salvar",
  pagamento: "Pagamento",
  push: "Notificação push",
  whatsapp: "WhatsApp",
  cron: "Tarefa agendada",
  servidor: "Servidor",
};
const LEVEL: Record<Incident["level"], string> = { aviso: "Aviso", erro: "Erro", critico: "Crítico" };
const when = (iso: string) => `${formatDate(iso)} ${iso.slice(11, 16)}`;

function Monitoring() {
  const canResolve = useStaff().includes("super_admin");
  const [filter, setFilter] = useState<"aberto" | null>("aberto");
  const { data, reload, failed } = useAdminData<Incident[]>(() => supabase.rpc("admin_incidents", filter ? { p_status: filter } : {}), [filter]);
  const open = data?.filter((i) => i.status === "aberto") ?? [];

  async function resolve(id: string) {
    const { error } = await supabase.rpc("admin_resolve_incident", { p_id: id });
    if (error) return void toast.error(errMsg(error));
    toast.success("Marcado como resolvido. Se acontecer de novo, volta a aparecer aqui.");
    reload();
  }

  return (
    <AdminPage
      title="Monitoramento"
      intro="Falhas registradas pelo app e pelo servidor. A mesma falha soma na mesma linha. Mensagens não guardam e-mails nem números longos (pedidos, valores)."
      actions={
        <Button variant="outline" onClick={() => setFilter(filter ? null : "aberto")}>
          {filter ? "Ver histórico completo" : "Ver só abertos"}
        </Button>
      }
    >
      {!data ? (
        <Loading failed={failed} onRetry={reload} />
      ) : (
        <>
          <StatGrid>
            <Stat label="Abertos" value={String(open.length)} alert={open.length > 0} />
            <Stat label="Críticos abertos" value={String(open.filter((i) => i.level === "critico").length)} alert={open.some((i) => i.level === "critico")} />
            <Stat label="Pagamentos" value={String(open.filter((i) => i.source === "pagamento").length)} note="Abertos" />
            <Stat label="Falhas ao salvar" value={String(open.filter((i) => i.source === "salvamento").length)} note="Abertos" />
          </StatGrid>
          {!data.length ? (
            <p className="text-sm text-muted-foreground">Nenhum incidente {filter ? "aberto" : "registrado"}. Tudo funcionando.</p>
          ) : (
            <ul className="space-y-3">
              {data.map((i) => (
                <li key={i.id} className={cn("rounded-2xl bg-card p-4 shadow-card", i.status === "aberto" && i.level !== "aviso" && "ring-1 ring-destructive")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {SOURCE[i.source] ?? i.source} · {LEVEL[i.level]}
                        {i.path ? ` · ${i.path}` : ""}
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold">{i.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {i.count}× · primeira {when(i.first_at)} · última {when(i.last_at)}
                        {i.resolved_at ? ` · resolvido ${when(i.resolved_at)}` : ""}
                      </p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={STATUS_PILL}>{i.status === "aberto" ? "Aberto" : "Resolvido"}</span>
                      {canResolve && i.status === "aberto" && (
                        <Button size="sm" variant="outline" onClick={() => resolve(i.id)}>
                          Resolver
                        </Button>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AdminPage>
  );
}
