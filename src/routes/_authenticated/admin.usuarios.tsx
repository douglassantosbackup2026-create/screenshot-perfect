import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { isAdmin } from "@/lib/auth/roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminResyncSubscription, adminSubscriptionLink } from "@/lib/admin/users.functions";
import { formatDate } from "@/lib/labels";
import { formatMoney } from "@/lib/calc/format";
import { errMsg } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  beforeLoad: async () => {
    if (!(await isAdmin())) throw redirect({ to: "/hoje", replace: true });
  },
  head: () => pageHead("Admin de usuários", "Busca de contas, assinatura e cobrança.", "Busca de contas e assinatura."),
  component: AdminUsers,
});

type Payment = { id: string; status: string; amount_cents: number; period: string; created_at: string };
type UserRow = {
  user_id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  plan: string | null;
  valid_until: string | null;
  subscription_status: string | null;
  subscription_period: string | null;
  subscription_updated_at: string | null;
  payments: Payment[];
};

const SUB_LABEL: Record<string, string> = { pending: "Aguardando autorização", authorized: "Ativa", paused: "Pausada", cancelled: "Cancelada" };
const day = (iso: string | null) => (iso ? formatDate(iso) : "—");

function AdminUsers() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<UserRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim().length < 3) {
      toast.error("Digite pelo menos 3 letras do e-mail ou o id da conta.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_find_users", { p_query: query.trim() });
    setBusy(false);
    if (error) {
      toast.error(errMsg(error));
      return;
    }
    setRows(data.map((r) => ({ ...r, payments: Array.isArray(r.payments) ? (r.payments as unknown as Payment[]) : [] })));
  }

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-28 pt-8">
      <h1>Usuários</h1>
      <p className="mt-2 text-sm text-muted-foreground">Acesso só para administradores. A busca mostra até 20 contas.</p>
      <form onSubmit={search} className="mt-6 flex gap-2">
        <Input aria-label="E-mail ou id da conta" placeholder="E-mail ou id da conta" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button type="submit" disabled={busy}>
          Buscar
        </Button>
      </form>
      {rows && rows.length === 0 && <p className="mt-6 text-sm text-muted-foreground">Nenhuma conta encontrada.</p>}
      <ul className="mt-6 space-y-4">
        {rows?.map((r) => (
          <UserCard key={r.user_id} row={r} onChanged={search} />
        ))}
      </ul>
    </main>
  );
}

function UserCard({ row, onChanged }: { row: UserRow; onChanged: () => void }) {
  const makeLink = useServerFn(adminSubscriptionLink);
  const resync = useServerFn(adminResyncSubscription);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = row.valid_until !== null && new Date(row.valid_until) > new Date();

  async function generate(period: "mensal" | "anual") {
    setBusy(true);
    try {
      const r = await makeLink({ data: { userId: row.user_id, period } });
      if (r.error) toast.error(r.error);
      else {
        setLink(r.url);
        onChanged();
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    try {
      const r = await resync({ data: { userId: row.user_id } });
      if (r.error) toast.error(r.error);
      else {
        toast.success(`Status atualizado: ${SUB_LABEL[r.status ?? ""] ?? r.status}.`);
        onChanged();
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie.");
    }
  }

  return (
    <li className="rounded-2xl bg-card p-4 shadow-card">
      <p className="break-all font-semibold">{row.email}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {row.display_name ? `${row.display_name} · ` : ""}conta criada em {day(row.created_at)} · último acesso {day(row.last_sign_in_at)}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Acesso</dt>
        <dd>{row.plan ? `${row.plan === "pro" ? "Pro" : "Inteligência"} ${active ? "até" : "venceu em"} ${day(row.valid_until)}` : "Sem plano"}</dd>
        <dt className="text-muted-foreground">Assinatura</dt>
        <dd>
          {row.subscription_status ? `${SUB_LABEL[row.subscription_status] ?? row.subscription_status} (${row.subscription_period})` : "Nenhuma"}
        </dd>
      </dl>
      {row.payments.length > 0 && (
        <>
          <p className="eyebrow mt-4">Últimos pagamentos</p>
          <ul className="mt-1 text-sm">
            {row.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 py-1">
                <span>
                  {day(p.created_at)} · {p.period}
                </span>
                <span className="money">
                  {formatMoney(p.amount_cents)} · {p.status}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => generate("mensal")}>
          Link de cobrança mensal
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => generate("anual")}>
          Link anual
        </Button>
        {row.subscription_status && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={sync}>
            Ressincronizar com o Mercado Pago
          </Button>
        )}
      </div>
      {link && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted p-2">
          <code className="min-w-0 flex-1 truncate text-xs">{link}</code>
          <Button size="icon" variant="ghost" aria-label="Copiar link" onClick={copy}>
            <Copy size={16} />
          </Button>
        </div>
      )}
    </li>
  );
}
