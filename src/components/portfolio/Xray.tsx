// Raio-X do patrimônio: concentração, liquidez e "o que fazer agora".
// Só exibe; a conta vem de src/lib/calc/xray.ts via xrayView.
import { Link } from "@tanstack/react-router";
import { ScanSearch } from "lucide-react";
import { Blurred } from "@/components/Upgrade";
import { formatPercent } from "@/lib/calc/format";
import type { XrayIssue } from "@/lib/calc/xray";
import type { DemoState } from "@/lib/data/demo-store";
import { xrayView } from "@/lib/data/selectors";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function issueText(
  i: XrayIssue,
  largestName: string | null,
): { text: string; to: "/patrimonio" | "/orcamento" } {
  switch (i.code) {
    case "endividado":
      return {
        text: `As dívidas somam ${formatPercent(i.value)} do que você tem. Vale começar por elas, das mais caras para as mais baratas.`,
        to: "/patrimonio",
      };
    case "sem_reserva":
      return {
        text: `A reserva de emergência está em ${formatPercent(i.value)} do recomendado (6 meses do custo essencial).`,
        to: "/orcamento",
      };
    case "divida_sem_juros":
      return {
        text: `${plural(i.value, "dívida", "dívidas")} sem juros informados: sem eles, não dá para saber se vale quitar primeiro.`,
        to: "/patrimonio",
      };
    case "concentrado":
      return {
        text: `${formatPercent(i.value)} do patrimônio está em ${largestName ?? "um só item"}. Um imprevisto ali pesa em tudo.`,
        to: "/patrimonio",
      };
    case "desatualizado":
      return {
        text: `${plural(i.value, "item está", "itens estão")} sem atualização há mais de 90 dias.`,
        to: "/patrimonio",
      };
  }
}

export function XrayCard({ s }: { s: DemoState }) {
  const x = xrayView(s);
  if (x.assetsTotal === 0 && x.debtsTotal === 0) return null;
  return (
    <section className="mt-4 rounded-2xl bg-card p-5 shadow-card" aria-label="Raio-X do patrimônio">
      <h2 className="flex items-center gap-2 text-lg">
        <ScanSearch size={18} className="text-primary" aria-hidden /> Raio-X
      </h2>
      <Blurred feature="xray">
        <dl className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Maior item</dt>
            <dd className="font-display text-lg font-semibold">
              {x.largest ? formatPercent(x.largest.share) : "—"}
            </dd>
          </div>
          <div className="rounded-2xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Vira dinheiro em 30 dias</dt>
            <dd className="font-display text-lg font-semibold">
              {x.liquidShare !== null ? formatPercent(x.liquidShare) : "—"}
            </dd>
          </div>
          <div className="rounded-2xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Pontos de atenção</dt>
            <dd className="font-display text-lg font-semibold">{x.issues.length}</dd>
          </div>
        </dl>
        {x.actions.length > 0 ? (
          <>
            <h3 className="mt-4 text-base">O que fazer agora</h3>
            <ol className="mt-2 space-y-2">
              {x.actions.map((a) => {
                const t = issueText(a, x.largest?.name ?? null);
                return (
                  <li key={a.code}>
                    <Link
                      to={t.to}
                      className="flex items-start justify-between gap-3 rounded-xl bg-muted p-3 text-sm hover:underline"
                    >
                      {t.text}
                      <span aria-hidden className="text-primary">
                        →
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Nada urgente: patrimônio espalhado, reserva no lugar e dados em dia.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Liquidez considera reserva e investimentos; previdência e imóveis demoram mais para virar
          dinheiro. Com base nos valores que você informou.
        </p>
      </Blurred>
    </section>
  );
}
