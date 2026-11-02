import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, XCircle } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { requireModule } from "@/lib/admin/modules";
import { adminIntegrations } from "@/lib/admin/panel.functions";
import { AdminPage, Card, Loading } from "@/components/admin/kit";
import { useAdminData } from "@/components/admin/hooks";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/labels";
import { errMsg } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/admin/configuracoes")({
  beforeLoad: ({ context }) => requireModule(context.staff, "/admin/configuracoes"),
  head: () => pageHead("Configurações", "Cobrança, integrações e retenção de dados.", "Configurações."),
  component: Settings,
});

const RETENTION = [
  ["Eventos de medição (com aceite)", "13 meses"],
  ["Contagens anônimas por dia", "25 meses"],
  ["Leads", "24 meses"],
  ["Mensagens do WhatsApp", "90 dias"],
  ["Incidentes resolvidos", "180 dias"],
  ["Registro de auditoria", "5 anos"],
  ["Dados da conta", "Enquanto a conta existir"],
];

function Settings() {
  const { data: s, failed, reload } = useAdminData<{ billing_enforced: boolean; updated_at: string }>(() => supabase.rpc("admin_settings"), []);
  const integrations = useServerFn(adminIntegrations);
  const { data: integ, failed: integFailed, reload: integReload } = useAdminData<{ error: string | null; items: { name: string; ok: boolean }[] }>(
    () => integrations().then((r) => ({ data: r, error: r.error })),
    [],
  );
  const [busy, setBusy] = useState(false);

  async function toggleBilling(on: boolean) {
    if (!on && !window.confirm("Desligar a cobrança obrigatória libera o app para todo mundo gravar dados sem assinatura. Continuar?")) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_billing_enforced", { p_on: on });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success(on ? "Cobrança obrigatória ligada." : "Cobrança obrigatória desligada.");
    reload();
  }

  return (
    <AdminPage title="Configurações" intro="Ajustes gerais. Mudanças aqui ficam no registro de auditoria.">
      <Card title="Cobrança obrigatória no banco" note="Com ela ligada, só quem tem assinatura grava os próprios dados (o app também confere pela variável VITE_BILLING_ENABLED).">
        {!s ? (
          <Loading failed={failed} onRetry={reload} />
        ) : (
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              {s.billing_enforced ? "Ligada" : "Desligada"}
              <span className="block text-xs text-muted-foreground">Alterada em {formatDate(s.updated_at)}</span>
            </span>
            <Switch checked={s.billing_enforced} disabled={busy} onCheckedChange={toggleBilling} aria-label="Cobrança obrigatória" />
          </label>
        )}
      </Card>

      <Card title="Integrações" note="Só mostra se cada uma está configurada neste ambiente; os segredos nunca aparecem aqui.">
        {!integ ? (
          <Loading failed={integFailed} onRetry={integReload} />
        ) : (
          <ul className="space-y-2 text-sm">
            {integ.items.map((i) => (
              <li key={i.name} className="flex items-center gap-2">
                {i.ok ? <CheckCircle2 size={16} className="text-primary" aria-hidden /> : <XCircle size={16} className="text-muted-foreground" aria-hidden />}
                <span>{i.name}</span>
                <span className="text-muted-foreground">· {i.ok ? "configurada" : "não configurada"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Atalhos">
        <div className="flex flex-wrap gap-3 text-sm font-semibold text-primary">
          <Link to="/admin/precos">Preços dos planos</Link>
          <Link to="/admin/cupons">Cupons</Link>
          <Link to="/admin/calculadora">Premissas da calculadora</Link>
          <Link to="/admin/seguranca">Perfis e auditoria</Link>
        </div>
      </Card>

      <Card title="Retenção de dados" note="Apagados automaticamente pela tarefa diária (purge_expired)">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {RETENTION.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </AdminPage>
  );
}
