import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { requireModule } from "@/lib/admin/modules";
import { AdminPage, Card, Loading, STATUS_PILL } from "@/components/admin/kit";
import { useAdminData, useCanWrite } from "@/components/admin/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/labels";
import { errMsg } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/admin/leads")({
  beforeLoad: ({ context }) => requireModule(context.staff, "/admin/leads"),
  head: () => pageHead("Leads", "Captação e acompanhamento comercial.", "Leads."),
  component: Leads,
});

type Lead = {
  id: string;
  email: string;
  source: string;
  created_at: string;
  utm_source: string | null;
  utm_campaign: string | null;
  notes: string;
  owner_email: string | null;
  status: "novo" | "contatado" | "convertido" | "descartado";
};

const STATUS: Record<Lead["status"], string> = { novo: "Novo", contatado: "Contatado", convertido: "Convertido", descartado: "Descartado" };
const ALL = "todos";

/** CSV com ponto e vírgula (abre direto no Excel em português); aspas em todo campo. */
function toCsv(rows: Lead[]) {
  const q = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const head = ["email", "origem", "data", "utm_source", "utm_campaign", "situacao", "observacoes"];
  return [head.join(";"), ...rows.map((l) => [l.email, l.source, l.created_at.slice(0, 10), l.utm_source, l.utm_campaign, STATUS[l.status], l.notes].map(q).join(";"))].join("\r\n");
}

function Leads() {
  const canWrite = useCanWrite("/admin/leads");
  const [status, setStatus] = useState(ALL);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const { data, reload, failed } = useAdminData<Lead[]>(
    () => supabase.rpc("admin_leads", { ...(status !== ALL && { p_status: status }), ...(search && { p_query: search }) }),
    [status, search],
  );

  async function exportCsv() {
    if (!data?.length) return;
    const { error } = await supabase.rpc("admin_log_export", { p_what: "leads", p_rows: data.length });
    if (error) return void toast.error(errMsg(error));
    const url = URL.createObjectURL(new Blob(["﻿" + toCsv(data)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminPage
      title="Leads"
      intro="E-mails deixados com consentimento (calculadora e listas de espera). Quem virou conta aparece como convertido. Leads com mais de 24 meses são apagados automaticamente."
      actions={
        canWrite && (
          <Button variant="outline" disabled={!data?.length} onClick={exportCsv}>
            Exportar CSV
          </Button>
        )
      }
    >
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
        }}
      >
        <Input className="h-11 w-64" placeholder="Buscar e-mail" aria-label="Buscar e-mail" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 w-44 rounded-xl bg-card" aria-label="Situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {(Object.keys(STATUS) as Lead["status"][]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </form>
      {!data ? (
        <Loading failed={failed} onRetry={reload} />
      ) : !data.length ? (
        <p className="text-sm text-muted-foreground">Nenhum lead aqui.</p>
      ) : (
        <ul className="space-y-3">
          {data.map((l) => (
            <LeadCard key={l.id} lead={l} canWrite={canWrite} onChanged={reload} />
          ))}
        </ul>
      )}
    </AdminPage>
  );
}

function LeadCard({ lead, canWrite, onChanged }: { lead: Lead; canWrite: boolean; onChanged: () => void }) {
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.notes);
  const [busy, setBusy] = useState(false);
  const dirty = status !== lead.status || notes !== lead.notes;

  async function save() {
    setBusy(true);
    const { error } = await supabase.rpc("admin_update_lead", { p_id: lead.id, p_status: status, p_notes: notes });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("Lead atualizado.");
    onChanged();
  }

  return (
    <li>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="break-all font-semibold">{lead.email}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(lead.created_at)} · {lead.source}
              {lead.utm_source ? ` · ${lead.utm_source}` : ""}
              {lead.utm_campaign ? ` / ${lead.utm_campaign}` : ""}
              {lead.owner_email ? ` · com ${lead.owner_email}` : ""}
            </p>
          </div>
          {!canWrite && <span className={STATUS_PILL}>{STATUS[lead.status]}</span>}
        </div>
        {canWrite && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as Lead["status"])}>
              <SelectTrigger className="h-11 w-40 rounded-xl bg-muted" aria-label={`Situação de ${lead.email}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS) as Lead["status"][]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input className="h-11 min-w-0 flex-1" maxLength={1000} placeholder="Observações" aria-label={`Observações sobre ${lead.email}`} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button size="sm" disabled={!dirty || busy} onClick={save}>
              Salvar
            </Button>
          </div>
        )}
      </Card>
    </li>
  );
}
