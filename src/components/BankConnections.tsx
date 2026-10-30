// Bancos conectados por Open Finance (Contas). Atrás de VITE_OPEN_FINANCE_ENABLED: hoje só o provedor de
// teste existe, então fica desligado em produção até um agregador ser contratado.
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ConfirmButton";
import { supabase } from "@/integrations/supabase/client";
import { connectBank, syncBank } from "@/lib/openfinance/openfinance.functions";
import { reloadFromCloudNow } from "@/lib/data/demo-store";
import { formatDate } from "@/lib/labels";
import { errMsg } from "@/lib/errors";

export const OPEN_FINANCE_ENABLED = import.meta.env["VITE_OPEN_FINANCE_ENABLED"] === "true";

type Conn = { id: string; institution: string | null; status: string; last_synced_at: string | null };
const STATUS: Record<string, string> = { ativa: "Conectado", erro: "Com erro na última sincronização", revogada: "Autorização encerrada" };

export function BankConnections() {
  const connect = useServerFn(connectBank);
  const sync = useServerFn(syncBank);
  const [conns, setConns] = useState<Conn[] | null>(null);
  const [busy, setBusy] = useState(false);

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
    // As contas e os lançamentos já trazidos ficam; só param de atualizar.
    const { error } = await supabase.from("bank_connections").delete().eq("id", id);
    if (error) toast.error("Não foi possível desconectar agora.");
    await load();
  }

  return (
    <section className="mt-8 rounded-2xl bg-card p-5 shadow-card" aria-label="Bancos conectados">
      <h2 className="text-base">Bancos conectados</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Pelo Open Finance, os lançamentos chegam sozinhos, com as mesmas regras da importação de extrato. Versão de teste: usa um banco
        fictício.
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
        onClick={() => void run(() => connect({ data: { itemId: crypto.randomUUID(), institution: "Banco Teste" } }))}
      >
        Conectar banco de teste
      </Button>
    </section>
  );
}
