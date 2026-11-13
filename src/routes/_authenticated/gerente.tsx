import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/calc/format";
import { formatRate } from "@/lib/calc/commission";
import { errMsg } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/gerente")({
  head: () => pageHead("Área do gerente", "Seus parceiros, as vendas deles e sua comissão.", "Seus parceiros e comissões."),
  component: ManagerPanel,
});

type Partner = { id: string; name: string; status: string; code: string | null; referrals: number; sales_cents: number; partner_cents: number; manager_cents: number };
type Mine = { name: string; code: string; commission_bp: number; pending_cents: number; paid_cents: number; partners: Partner[] };
const STATUS: Record<string, string> = { pendente: "Em análise", aprovado: "Ativo", recusado: "Recusado", suspenso: "Suspenso" };

function ManagerPanel() {
  const [mine, setMine] = useState<Mine | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void supabase.rpc("my_manager").then(({ data, error }) => {
      if (!live) return;
      if (error) toast.error(errMsg(error));
      setMine(error ? null : (data as unknown as Mine | null));
    });
    return () => {
      live = false;
    };
  }, []);

  const link = mine ? `${typeof window === "undefined" ? "" : window.location.origin}/parceiros?gerente=${mine.code}` : "";
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie.");
    }
  }

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-28 pt-8">
      <h1>Área do gerente</h1>
      {mine === undefined && <div className="mt-6 h-36 animate-pulse rounded-2xl bg-card" aria-busy="true" />}
      {mine === null && (
        <section className="mt-6 rounded-2xl bg-card p-6 shadow-card">
          <p>Esta conta não é de um gerente.</p>
          <p className="mt-2 text-sm text-muted-foreground">O gerente entra com o e-mail cadastrado pela equipe, já confirmado.</p>
        </section>
      )}
      {mine && (
        <>
          <section className="mt-6 rounded-2xl bg-card p-5 shadow-card">
            <p className="eyebrow">Link para convidar parceiros</p>
            <div className="mt-1 flex items-center gap-2 rounded-xl bg-muted p-2">
              <code className="min-w-0 flex-1 truncate text-xs">{link}</code>
              <Button size="icon" variant="ghost" aria-label="Copiar link" onClick={copy}>
                <Copy size={16} />
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Quem se inscreve por este link fica no seu time depois de aprovado. Você ganha {formatRate(mine.commission_bp)} de cada pagamento que gera comissão para
              um parceiro seu. A comissão dele não diminui.
            </p>
          </section>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              ["Parceiros", String(mine.partners.length)],
              ["A receber", formatMoney(mine.pending_cents)],
              ["Recebido", formatMoney(mine.paid_cents)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-card p-4 shadow-card">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="money mt-1 text-lg">{v}</dd>
              </div>
            ))}
          </dl>
          <h2 className="mt-10 text-lg">Seus parceiros</h2>
          {mine.partners.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Ainda nenhum. Envie o link acima para quem quer divulgar.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {mine.partners.map((p) => (
                <li key={p.id} className="rounded-2xl bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{p.name}</p>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{STATUS[p.status] ?? p.status}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Indicados</dt>
                    <dd className="money">{p.referrals}</dd>
                    <dt className="text-muted-foreground">Vendas</dt>
                    <dd className="money">{formatMoney(p.sales_cents)}</dd>
                    <dt className="text-muted-foreground">Comissão do parceiro</dt>
                    <dd className="money">{formatMoney(p.partner_cents)}</dd>
                    <dt className="text-muted-foreground">Sua comissão</dt>
                    <dd className="money text-primary">{formatMoney(p.manager_cents)}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
