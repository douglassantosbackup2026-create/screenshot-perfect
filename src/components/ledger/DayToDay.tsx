// Cartões do dia a dia: avisos do mês, fim do mês, parcelas, desfazer e reserva de emergência.
// Só exibem; as contas vêm de src/lib/calc via src/lib/data/selectors.
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, CreditCard, LifeBuoy, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ConfirmButton";
import { runAction } from "@/components/feedback";
import { Progress } from "@/components/ui/progress";
import { HIDDEN } from "@/lib/labels";
import { Blurred, useFeature } from "@/components/Upgrade";
import { formatMoney, formatPercent } from "@/lib/calc/format";
import { demo, type DemoState } from "@/lib/data/demo-store";
import {
  dailyAlerts,
  emergencyFundView,
  installmentsView,
  monthProjection,
  undoAvailable,
  type DailyAlert,
} from "@/lib/data/selectors";
import { addDays } from "@/lib/calc/recurring";
import { spDate } from "@/lib/gamification/rules";
import { formatDate, monthShort } from "@/lib/labels";
import { cn } from "@/lib/utils";

const dayLabel = (d: string) => formatDate(`${d}T12:00:00Z`);
const useMoney = (showValues: boolean) => (cents: number) =>
  showValues ? formatMoney(cents) : HIDDEN;

/** Frase de cada aviso. `money` respeita o "ocultar valores". */
function alertText(a: DailyAlert, money: (c: number) => string): string {
  switch (a.kind) {
    case "orcamento":
      return a.level === "limite"
        ? `${a.envelopeName}: o envelope ${a.spent > a.available ? "passou do limite" : "chegou ao limite"} (${money(a.spent)} de ${money(a.available)}).`
        : `${a.envelopeName}: já foi ${formatPercent(a.pct)} do envelope (${money(a.spent)} de ${money(a.available)}).`;
    case "duplicado":
      return `${a.payee}: ${money(a.amount)} lançado duas vezes (${a.dates.map(dayLabel).join(" e ")}). Confira se a cobrança foi repetida.`;
    case "preco":
      return `${a.payee} mudou de ${money(a.before)} para ${money(a.after)}.`;
    case "acima_media":
      return `${a.isCard ? `Fatura do ${a.name}` : a.name} está ${formatPercent(a.pct)} acima da média dos últimos 3 meses (${money(a.current)} contra ${money(a.average)}).`;
    case "limite":
      return a.level === "limite"
        ? `Limite de ${a.name} ${a.per} ${a.spent > a.limit ? "passou" : "chegou ao fim"} (${money(a.spent)} de ${money(a.limit)}).`
        : `Limite de ${a.name} ${a.per}: já foi ${formatPercent(a.pct)} (${money(a.spent)} de ${money(a.limit)}).`;
  }
}

/** Avisos do plano gratuito: os que vêm do orçamento e dos limites que a própria pessoa definiu. */
const isFreeAlert = (a: DailyAlert) => a.kind === "orcamento" || a.kind === "limite";

/**
 * Avisos do mês. Os de orçamento são do plano gratuito; cobrança repetida, preço e média
 * ficam atrás do recurso "Avisos de cobranças".
 */
export function DailyAlertsCard({
  s,
  showValues,
  className,
  title = "Avisos do mês",
}: {
  s: DemoState;
  showValues: boolean;
  className?: string;
  title?: string;
}) {
  const money = useMoney(showValues);
  const anomalies = useFeature("anomaly_alerts");
  const all = dailyAlerts(s);
  const budget = all.filter(isFreeAlert);
  const others = all.filter((a) => !isFreeAlert(a));
  if (!all.length) return null;
  const shown = anomalies.allowed ? all : budget;
  const hidden = anomalies.allowed ? 0 : others.length;

  return (
    <section className={cn("rounded-2xl bg-card p-5 shadow-card", className)} aria-label={title}>
      <h2 className="flex items-center gap-2 text-base">
        <AlertTriangle size={18} strokeWidth={1.75} className="text-primary" aria-hidden />
        {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {shown.map((a) => (
          <li
            key={a.key}
            className="flex items-start justify-between gap-3 rounded-xl bg-muted p-3 text-sm"
          >
            <Link
              to={a.kind === "orcamento" ? "/orcamento" : "/diario"}
              className="min-w-0 hover:underline"
            >
              {alertText(a, money)}
            </Link>
            <button
              type="button"
              aria-label="Ignorar este aviso"
              onClick={() => demo.dismissAlert(a.key)}
              className="-my-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground"
            >
              <X size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={anomalies.ask}
          className="mt-3 text-left text-sm font-semibold text-primary hover:underline"
        >
          {hidden === 1 ? "Mais 1 aviso de cobrança" : `Mais ${hidden} avisos de cobranças`} no
          plano Inteligência
        </button>
      )}
      {anomalies.dialog}
    </section>
  );
}

/** Fim do mês: saldo de hoje + o que está agendado (recorrências e parcelas) até o último dia. */
export function MonthEndCard({ s, showValues }: { s: DemoState; showValues: boolean }) {
  const money = useMoney(showValues);
  const p = monthProjection(s);
  if (!p) return null;
  const tight = p.lowestPoint < 0;
  return (
    <section className="mt-4 rounded-2xl bg-card p-5 shadow-card" aria-label="Fim do mês">
      <h3 className="flex items-center gap-2 text-base">
        <CalendarClock size={18} strokeWidth={1.75} className="text-primary" aria-hidden /> Fim do
        mês
      </h3>
      <Blurred feature="month_projection">
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Saldo hoje</dt>
            <dd
              className={cn(
                "money font-display text-lg font-bold",
                p.start < 0 && "text-destructive",
              )}
            >
              {money(p.start)}
            </dd>
          </div>
          <div className="rounded-2xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Ainda entra</dt>
            <dd className="money font-display text-lg font-bold text-primary">
              {money(p.inflows)}
            </dd>
          </div>
          <div className="rounded-2xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Ainda sai</dt>
            <dd className="money font-display text-lg font-bold">{money(p.outflows)}</dd>
          </div>
          <div className="rounded-2xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Deve fechar em</dt>
            <dd
              className={cn(
                "money font-display text-lg font-bold",
                p.projected < 0 && "text-destructive",
              )}
            >
              {money(p.projected)}
            </dd>
          </div>
        </dl>
        {tight && p.lowestDate !== spDate(new Date()) && (
          <p className="mt-3 rounded-xl bg-destructive/15 p-3 text-sm text-destructive">
            O saldo fica negativo em {dayLabel(p.lowestDate)} ({money(p.lowestPoint)}). Vale
            adiantar uma entrada ou adiar um pagamento.
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Contas do dia a dia e cartões. Entra só o que está agendado (recorrências e parcelas) até{" "}
          {dayLabel(p.monthEnd)}; gastos do dia a dia que ainda vão acontecer não entram.
        </p>
      </Blurred>
    </section>
  );
}

/** Compras parceladas em andamento e quanto ainda cai nos próximos meses. */
export function InstallmentsCard({ s, showValues }: { s: DemoState; showValues: boolean }) {
  const money = useMoney(showValues);
  const v = installmentsView(s);
  if (!v.purchases.length) return null;
  const max = Math.max(...v.byMonth.map((m) => m.amount), 1);
  function cancel(ruleId: string, payee: string) {
    demo.deleteInstallmentPurchase(ruleId, "futuras");
    toast(`Parcelas futuras de ${payee} canceladas. As já lançadas continuam.`);
  }
  return (
    <section
      className="mt-4 rounded-2xl bg-card p-5 shadow-card"
      aria-label="Comprometido nos próximos meses"
    >
      <h3 className="flex items-center gap-2 text-base">
        <CreditCard size={18} strokeWidth={1.75} className="text-primary" aria-hidden />{" "}
        Comprometido nos próximos meses
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        <span className="money">{money(v.total)}</span> em parcelas que ainda vão cair.
      </p>
      <ul className="mt-3 grid grid-cols-6 items-end gap-2" aria-label="Parcelas por mês">
        {v.byMonth.map((m) => (
          <li key={m.month} className="text-center">
            <div className="flex h-16 items-end justify-center" aria-hidden>
              <div
                className="w-full rounded-t-md bg-primary/70"
                style={{ height: `${m.amount ? Math.max((m.amount / max) * 100, 6) : 0}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{monthShort(m.month)}</p>
            <p className="money text-[11px]">{m.amount ? money(m.amount) : "—"}</p>
          </li>
        ))}
      </ul>
      <ul className="mt-4 divide-y divide-border text-sm">
        {v.purchases.map((p) => (
          <li key={p.rule.id} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{p.rule.payee}</span>
              <span className="block text-xs text-muted-foreground">
                faltam {p.left} de {p.count} · <span className="money">{money(p.remaining)}</span>
              </span>
            </span>
            <ConfirmButton size="sm" confirmLabel="Confirmar" onConfirm={() => cancel(p.rule.id, p.rule.payee)}>
              Cancelar as próximas
            </ConfirmButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Desfazer" da última mudança nos lançamentos, por 24 horas. */
export function UndoBar({ s }: { s: DemoState }) {
  const u = undoAvailable(s);
  if (!u) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-2 text-sm">
      <span>
        Última mudança: <span className="font-semibold">{u.label.toLowerCase()}</span>
      </span>
      <Button size="sm" variant="outline" onClick={() => runAction(() => demo.undoLast(), (label) => `${label} desfeito.`)}>
        <Undo2 size={14} aria-hidden /> Desfazer
      </Button>
    </div>
  );
}

/** Reserva de emergência: 6 meses do custo essencial, com atalho para criar o envelope com meta. */
export function ReserveCard({
  s,
  showValues,
  className,
}: {
  s: DemoState;
  showValues: boolean;
  className?: string;
}) {
  const money = useMoney(showValues);
  const r = emergencyFundView(s);
  const hasEnvelope = s.categories.some(
    (c) =>
      c.name === "Reserva de emergência" && s.budget.templates.some((t) => t.envelopeId === c.id),
  );
  function create() {
    try {
      demo.saveReserveEnvelope(r.missing, addDays(spDate(new Date()), 365));
      toast.success("Envelope Reserva de emergência criado com meta para 12 meses.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <section
      className={cn("rounded-2xl bg-card p-5 shadow-card", className)}
      aria-label="Reserva de emergência"
    >
      <h2 className="flex items-center gap-2 text-lg">
        <LifeBuoy size={18} className="text-primary" aria-hidden /> Reserva de emergência
      </h2>
      {r.monthlyEssential === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Com 3 meses de lançamentos de moradia, mercado, transporte, saúde e contas fixas,
          calculamos quanto guardar para 6 meses sem renda.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Custo essencial de <span className="money">{money(r.monthlyEssential)}</span> por mês ×
            6 = <span className="money font-semibold text-foreground">{money(r.target)}</span>.
          </p>
          <Progress
            value={r.pct * 100}
            className="mt-3"
            aria-label="Reserva de emergência guardada"
          />
          <p className="mt-2 text-sm">
            {r.source ? (
              <>
                Guardado: <span className="money">{money(r.current)}</span>, cobre{" "}
                {r.monthsCovered.toLocaleString("pt-BR")} {r.monthsCovered === 1 ? "mês" : "meses"}.
                {r.missing > 0 && (
                  <>
                    {" "}
                    Faltam <span className="money">{money(r.missing)}</span>.
                  </>
                )}
              </>
            ) : (
              "Cadastre a reserva no Patrimônio (item “Reserva de emergência”) ou uma conta poupança para acompanhar."
            )}
          </p>
          {r.missing > 0 && !hasEnvelope && (
            <Button variant="outline" size="sm" className="mt-3" onClick={create}>
              Criar envelope com meta em 12 meses
            </Button>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            A reserva vem antes de aumentar o aporte da aposentadoria: é ela que evita resgatar a
            previdência num imprevisto.
          </p>
        </>
      )}
    </section>
  );
}
