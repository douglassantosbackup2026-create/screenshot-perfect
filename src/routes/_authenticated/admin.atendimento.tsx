import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { requireModule } from "@/lib/admin/modules";
import { AdminPage, Loading, STATUS_PILL } from "@/components/admin/kit";
import { useAdminData, useCanWrite } from "@/components/admin/hooks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/labels";
import { TICKET_KIND, TICKET_STATUS, type TicketKind, type TicketStatus } from "@/lib/support/labels";
import { errMsg } from "@/lib/errors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/atendimento")({
  beforeLoad: ({ context }) => requireModule(context.staff, "/admin/atendimento"),
  head: () => pageHead("Atendimento", "Pedidos, dúvidas, reclamações e relatos de erro.", "Fila de atendimento."),
  component: Support,
});

type Ticket = {
  id: string;
  email: string;
  name: string;
  kind: TicketKind;
  subject: string;
  status: TicketStatus;
  assignee_email: string | null;
  created_at: string;
  updated_at: string;
  last_reply_by: "usuario" | "equipe";
  has_account: boolean;
  messages: { author: "usuario" | "equipe"; body: string; at: string }[];
};

const ALL = "todos";

function Support() {
  const [status, setStatus] = useState<string>(ALL);
  const [kind, setKind] = useState<string>(ALL);
  const { data, reload, failed } = useAdminData<Ticket[]>(() => supabase.rpc("admin_tickets", status === ALL ? {} : { p_status: status }), [status]);
  const list = (data ?? []).filter((t) => kind === ALL || t.kind === kind);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <AdminPage
      title="Atendimento"
      intro="Pedidos que chegam pelo Perfil (contas) e pela página de contato (sem conta). Responder aqui mostra a resposta para a pessoa no Perfil; quem escreveu pelo contato público recebe por e-mail, fora do app."
    >
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 w-48 rounded-xl bg-card" aria-label="Situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as situações</SelectItem>
            {(Object.keys(TICKET_STATUS) as TicketStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {TICKET_STATUS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="h-11 w-52 rounded-xl bg-card" aria-label="Tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os tipos</SelectItem>
            {(Object.keys(TICKET_KIND) as TicketKind[]).map((k) => (
              <SelectItem key={k} value={k}>
                {TICKET_KIND[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!data ? (
        <Loading failed={failed} onRetry={reload} />
      ) : !list.length ? (
        <p className="text-sm text-muted-foreground">Nenhum chamado aqui.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((t) => (
            <TicketCard key={t.id} t={t} open={open === t.id} onToggle={() => setOpen(open === t.id ? null : t.id)} onChanged={reload} />
          ))}
        </ul>
      )}
    </AdminPage>
  );
}

function TicketCard({ t, open, onToggle, onChanged }: { t: Ticket; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const canWrite = useCanWrite("/admin/atendimento");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const waiting = t.last_reply_by === "usuario" && (t.status === "aberto" || t.status === "em_andamento");

  async function act(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    setBusy(true);
    try {
      const { error } = await fn();
      if (error) toast.error(errMsg(error));
      else {
        toast.success(ok);
        setReply("");
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className={cn("rounded-2xl bg-card shadow-card", waiting && "ring-1 ring-primary/60")}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start justify-between gap-3 p-4 text-left">
        <span className="min-w-0">
          <span className="block font-semibold">{t.subject}</span>
          <span className="block break-all text-xs text-muted-foreground">
            {t.name ? `${t.name} · ` : ""}
            {t.email}
            {t.has_account ? "" : " · sem conta"} · aberto em {formatDate(t.created_at)}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className={STATUS_PILL}>{TICKET_STATUS[t.status]}</span>
          <span className="text-xs text-muted-foreground">{TICKET_KIND[t.kind]}</span>
          {waiting && <span className="text-xs font-semibold text-primary">Aguardando resposta</span>}
        </span>
      </button>
      {open && (
        <div className="border-t border-border p-4">
          <ol className="space-y-3">
            {t.messages.map((m, i) => (
              <li key={i} className={cn("rounded-xl p-3 text-sm", m.author === "equipe" ? "ml-6 bg-primary/10" : "mr-6 bg-muted")}>
                <p className="text-xs text-muted-foreground">
                  {m.author === "equipe" ? "Equipe" : "Pessoa"} · {formatDate(m.at)}
                </p>
                <p className="mt-1 whitespace-pre-line">{m.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground">Responsável: {t.assignee_email ?? "ninguém ainda"}</p>
          {canWrite && (
            <div className="mt-3 space-y-2">
              <label htmlFor={`r-${t.id}`} className="text-sm font-semibold">
                Responder
              </label>
              <Textarea id={`r-${t.id}`} rows={3} maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || !reply.trim()}
                  onClick={() => act(() => supabase.rpc("admin_ticket_reply", { p_ticket: t.id, p_body: reply }), "Resposta enviada.")}
                >
                  Enviar resposta
                </Button>
                {t.status !== "resolvido" && (
                  <Button variant="outline" disabled={busy} onClick={() => act(() => supabase.rpc("admin_ticket_update", { p_ticket: t.id, p_status: "resolvido" }), "Marcado como resolvido.")}>
                    Marcar como resolvido
                  </Button>
                )}
                {!t.assignee_email && (
                  <Button variant="ghost" disabled={busy} onClick={() => act(() => supabase.rpc("admin_ticket_update", { p_ticket: t.id, p_status: t.status, p_assign_me: true }), "Chamado assumido.")}>
                    Assumir
                  </Button>
                )}
                {t.status !== "fechado" && (
                  <Button variant="ghost" disabled={busy} onClick={() => act(() => supabase.rpc("admin_ticket_update", { p_ticket: t.id, p_status: "fechado" }), "Chamado fechado.")}>
                    Fechar
                  </Button>
                )}
              </div>
              {t.kind === "exclusao_dados" && (
                <p className="text-xs text-muted-foreground">
                  Pedido de exclusão: o super admin exclui pela ficha em Usuários (com confirmação do e-mail), ou a pessoa pode excluir sozinha em Perfil.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
