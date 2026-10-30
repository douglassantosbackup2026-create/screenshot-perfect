import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { isAdmin } from "@/lib/auth/roles";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { buildFunnel, funnelSources, type FunnelRow } from "@/lib/analytics/funnel";
import { formatPercent } from "@/lib/calc/format";
import { spDate } from "@/lib/gamification/rules";
import { errMsg } from "@/lib/errors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/funil")({
  beforeLoad: async () => {
    if (!(await isAdmin())) throw redirect({ to: "/hoje", replace: true });
  },
  head: () => pageHead("Funil", "Visitas, calculadora, cadastro e assinatura, de quem aceitou a medição.", "Funil de conversão."),
  component: AdminFunnel,
});

function daysAgo(n: number) {
  return spDate(new Date(Date.now() - n * 86_400_000));
}

function AdminFunnel() {
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(daysAgo(0));
  const [rows, setRows] = useState<FunnelRow[] | null>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    if (!from || !to || from > to) return;
    let live = true;
    void supabase.rpc("admin_funnel", { p_from: from, p_to: to }).then(({ data, error }) => {
      if (!live) return;
      if (error) toast.error(errMsg(error));
      else setRows(data);
    });
    return () => {
      live = false;
    };
  }, [from, to]);

  const steps = rows ? buildFunnel(rows, source) : [];
  const sources = rows ? funnelSources(rows) : [];
  const top = steps[0]?.people ?? 0;

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-28 pt-8">
      <h1>Funil</h1>
      <p className="mt-2 text-sm text-muted-foreground">Pessoas distintas em cada etapa, só de quem aceitou a medição. A origem é a da primeira visita no período.</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold">De</span>
          <Input type="date" className="mt-1.5" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Até</span>
          <Input type="date" className="mt-1.5" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {sources.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Origem">
          {[{ source: null as string | null, people: 0 }, ...sources].map((s) => (
            <button
              key={s.source ?? "todas"}
              type="button"
              aria-pressed={source === s.source}
              onClick={() => setSource(s.source)}
              className={cn("min-h-11 rounded-full px-3 text-sm ring-1", source === s.source ? "bg-primary text-primary-foreground ring-primary" : "bg-muted ring-border")}
            >
              {s.source ?? "Todas as origens"}
            </button>
          ))}
        </div>
      )}

      {!rows && <p className="mt-6 text-sm text-muted-foreground">Carregando…</p>}
      {rows && top === 0 && <p className="mt-6 text-sm text-muted-foreground">Nenhuma visita medida no período.</p>}
      {rows && (
        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <li key={s.key} className="rounded-2xl bg-card p-4 shadow-card">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{s.label}</span>
                <span className="money text-lg font-semibold">{s.people.toLocaleString("pt-BR")}</span>
              </div>
              <Progress value={top > 0 ? (s.people / top) * 100 : 0} className="mt-3 h-2" aria-label={`${s.label}: ${s.people} pessoas`} />
              {i > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {s.fromPrevious !== null ? `${formatPercent(s.fromPrevious)} da etapa anterior` : "Etapa anterior sem pessoas"}
                  {s.fromFirst !== null && ` · ${formatPercent(s.fromFirst)} do total`}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
