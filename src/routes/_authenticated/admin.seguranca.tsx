import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { requireModule, ROLE_HINT, ROLE_LABEL, type StaffRole } from "@/lib/admin/modules";
import { AdminPage, Card, Loading, STATUS_PILL, Table } from "@/components/admin/kit";
import { useAdminData } from "@/components/admin/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/labels";
import { errMsg } from "@/lib/errors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/seguranca")({
  beforeLoad: ({ context }) => requireModule(context.staff, "/admin/seguranca"),
  head: () => pageHead("Segurança", "Perfis da equipe e auditoria.", "Segurança e auditoria."),
  component: Security,
});

type Member = { user_id: string; email: string; roles: StaffRole[]; legacy_admin: boolean; mfa: boolean; last_sign_in_at: string | null };
type AuditRow = { id: number; at: string; actor_email: string | null; action: string; target: string | null; severity: "info" | "warning" | "high"; details: unknown };

const ROLES = Object.keys(ROLE_LABEL) as StaffRole[];
const SEVERITY: Record<AuditRow["severity"], string> = { info: "Info", warning: "Atenção", high: "Alta" };

function Security() {
  const { data: team, reload, failed } = useAdminData<Member[]>(() => supabase.rpc("admin_staff_list"), []);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("analista");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => PromiseLike<{ error: unknown }>, ok: string) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success(ok);
    reload();
  }

  return (
    <AdminPage
      title="Segurança"
      intro="Perfis da equipe e o registro de auditoria (somente leitura, guardado por 5 anos). Quem ativou o segundo fator precisa dele para usar o painel."
    >
      <Card title="Perfis de acesso">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {ROLES.map((r) => (
            <li key={r}>
              <span className="font-semibold">{ROLE_LABEL[r]}:</span> <span className="text-muted-foreground">{ROLE_HINT[r]}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Equipe" note="O admin original (user_roles) aparece como super admin e não pode ser removido por aqui.">
        {!team ? (
          <Loading failed={failed} onRetry={reload} />
        ) : (
          <ul className="divide-y divide-border">
            {team.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="break-all text-sm font-semibold">{m.email}</p>
                  <p className={cn("text-xs", m.mfa ? "text-muted-foreground" : "text-destructive")}>
                    {m.mfa ? "Segundo fator ativo" : "Sem segundo fator"} · último acesso {m.last_sign_in_at ? formatDate(m.last_sign_in_at) : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {m.roles.map((r) => (
                    <span key={r} className={cn(STATUS_PILL, "inline-flex items-center gap-1")}>
                      {ROLE_LABEL[r]}
                      {!(r === "super_admin" && m.legacy_admin) && (
                        <button
                          type="button"
                          className="min-h-6 px-1 text-muted-foreground hover:text-destructive"
                          aria-label={`Remover ${ROLE_LABEL[r]} de ${m.email}`}
                          disabled={busy}
                          onClick={() => run(() => supabase.rpc("admin_staff_revoke", { p_user: m.user_id, p_role: r }), "Perfil removido.")}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-4 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => supabase.rpc("admin_staff_grant", { p_email: email.trim(), p_role: role }), "Perfil concedido.").then(() => setEmail(""));
          }}
        >
          <Input className="h-11 min-w-0 flex-1" type="email" required placeholder="E-mail de uma conta existente" aria-label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select value={role} onValueChange={(v) => setRole(v as StaffRole)}>
            <SelectTrigger className="h-11 w-44 rounded-xl bg-muted" aria-label="Perfil">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={busy}>
            Conceder
          </Button>
        </form>
      </Card>

      <AuditLog />
    </AdminPage>
  );
}

function AuditLog() {
  const [severity, setSeverity] = useState<string>("todas");
  const [action, setAction] = useState("");
  const [query, setQuery] = useState("");
  const { data, failed, reload } = useAdminData<AuditRow[]>(
    () => supabase.rpc("admin_audit_log", { ...(severity !== "todas" && { p_severity: severity }), ...(query && { p_action: query }), p_limit: 200 }),
    [severity, query],
  );
  return (
    <Card title="Auditoria" note="Últimos 200 registros com os filtros escolhidos">
      <form
        className="mb-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(action.trim());
        }}
      >
        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="h-11 w-40 rounded-xl bg-muted" aria-label="Gravidade">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="warning">Atenção</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Input className="h-11 w-56" placeholder="Ação (ex.: admin_)" aria-label="Ação" value={action} onChange={(e) => setAction(e.target.value)} />
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>
      {!data ? (
        <Loading failed={failed} onRetry={reload} />
      ) : (
        <Table
          head={["Quando", "Quem", "Ação", "Alvo", "Gravidade"]}
          rows={data.map((a) => [
            `${formatDate(a.at)} ${a.at.slice(11, 16)}`,
            <span key="q" className="break-all">{a.actor_email ?? "servidor"}</span>,
            <code key="a" className="text-xs">{a.action}</code>,
            <span key="t" className="break-all text-xs text-muted-foreground">{a.target ?? "—"}</span>,
            <span key="s" className={STATUS_PILL}>{SEVERITY[a.severity]}</span>,
          ])}
          empty="Nenhum registro com esses filtros."
        />
      )}
    </Card>
  );
}
