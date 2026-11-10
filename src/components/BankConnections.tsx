// Bancos conectados por Open Finance (Contas), via Pluggy. Desligue com VITE_OPEN_FINANCE_ENABLED=false.
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ConfirmButton";
import { supabase } from "@/integrations/supabase/client";
import { connectBank, getConnectToken, syncBank } from "@/lib/openfinance/openfinance.functions";
import { reloadFromCloudNow } from "@/lib/data/demo-store";
import { formatDate } from "@/lib/labels";
import { errMsg } from "@/lib/errors";

const PluggyWidget = lazy(() => import("./PluggyWidget"));

export const OPEN_FINANCE_ENABLED = import.meta.env["VITE_OPEN_FINANCE_ENABLED"] !== "false";

type Conn = { id: string; institution: string | null; status: string; last_synced_at: string | null };
const STATUS: Record<string, string> = { ativa: "Conectado", erro: "Com erro na última sincronização", revogada: "Autorização encerrada" };

export function BankConnections() {
  const connect = useServerFn(connectBank);
  const sync = useServerFn(syncBank);
  const [conns, setConns] = useState<Conn[] | null>(null);
  const [busy, setBusy] = useState(false);
  const tokenFn = useServerFn(getConnectToken);
  const [widgetToken, setWidgetToken] = useState<string | null>(null);

  async function startConnect() {
    setBusy(true);
    try {
      const r = await tokenFn();
      if (r.error || !r.token) return void toast.error(r.error ?? "Não foi possível abrir a conexão.");
      if (r.provider === "mock") {
        setBusy(false);
        return void run(() => connect({ data: { itemId: crypto.randomUUID(), institution: "Banco Teste" } }));
      }
      setWidgetToken(r.token);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("bank_connections").select("id, institution, status, last_synced_at").order("created_at");
    if (error) toast.error("Não foi possível carregar os bancos conectados.");
    else setConns(data);
  }, []);
  useEffect(() => void load(), [load]);

  async function run(task: () => Promise<{ error: string | null; added: number }>) {
    setBusy(true);
    try {
      const r = await task();
      if (r.error) toast.error(r.error);
      else {
        await reloadFromCloudNow();
        toast.success(r.added ? `${r.added === 1 ? "1 lançamento novo" : `${r.added} lançamentos novos`} do banco.` : "Tudo em dia com o banco.");
      }
      await load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(id: string) {
    const { error } = await supabase.from("bank_connections").delete().eq("id", id);
    if (error) toast.error("Não foi possível desconectar agora.");
    await load();
  }

  return (
    <section className="mt-8 rounded-2xl bg-card p-5 shadow-card" aria-label="Bancos conectados">
      <h2 className="text-base">Bancos conectados</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pelo Open Finance, saldo, extrato, previdência e investimentos chegam sozinhos. Saídas que parecem aporte aparecem marcadas como
        "Possível aporte"; você decide se registra.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        O app só lê seus dados, nunca movimenta dinheiro. A autorização é feita no seu banco, pela Pluggy, e você pode encerrar quando
        quiser. Esses valores não vão para métricas nem são compartilhados.
      </p>
      <ul className="mt-3 divide-y divide-border">
        {conns?.map((c) => (
          <li key={c.id} className="py-3">
            <p className="font-semibold">{c.institution ?? "Banco"}</p>
            <p className="text-xs text-muted-foreground">
              {STATUS[c.status] ?? c.status}
              {c.last_synced_at && ` · atualizado em ${formatDate(c.last_synced_at)}`}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={busy || c.status === "revogada"} onClick={() => void run(() => sync({ data: { connectionId: c.id } }))}>
                Sincronizar agora
              </Button>
              <ConfirmButton size="sm" confirmLabel="Confirmar" onConfirm={() => void disconnect(c.id)}>
                Desconectar
              </ConfirmButton>
            </div>
          </li>
        ))}
      </ul>
      <Button
        className="mt-3 w-full"
        variant="outline"
        disabled={busy}
        onClick={() => void startConnect()}
      >
        Conectar meu banco
      </Button>
      {widgetToken && (
        <ClientOnly fallback={null}>
          <Suspense fallback={null}>
            <PluggyWidget
              token={widgetToken}
              onClose={() => setWidgetToken(null)}
              onSuccess={(itemId, institution) => {
                setWidgetToken(null);
                void run(() => connect({ data: { itemId, institution } }));
              }}
            />
          </Suspense>
        </ClientOnly>
      )}
    </section>
  );
}
