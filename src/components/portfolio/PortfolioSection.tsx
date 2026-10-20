// Investimentos no Patrimônio: posições pelo preço médio, alocação x metas e onde aportar este mês.
// Só exibe; as contas vêm de src/lib/calc/portfolio.ts por src/lib/data/selectors.ts.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NumberField, Segmented } from "@/components/forms";
import { HIDDEN } from "@/components/dashboard";
import { handleResult, xpToast } from "@/components/feedback";
import { ASSET_CLASSES, assetClassLabel, holdsPositions, type AssetClass, type TradeType } from "@/lib/calc/portfolio";
import { toCents } from "@/lib/calc/ledger";
import { formatMoney, formatPercent } from "@/lib/calc/format";
import { demo, type DemoState, type Holding } from "@/lib/data/demo-store";
import { contributionSuggestion, portfolioView } from "@/lib/data/selectors";
import { spDate } from "@/lib/gamification/rules";
import { formatDate } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Position = ReturnType<typeof portfolioView>["positions"][number];
const dayLabel = (d: string) => formatDate(`${d}T12:00:00Z`);
const qty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
const signedPct = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + formatPercent(Math.abs(v));

export function PortfolioSection({ s, showValues }: { s: DemoState; showValues: boolean }) {
  const v = portfolioView(s);
  const [editing, setEditing] = useState<{ holding: Holding | null } | null>(null);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const money = (c: number) => (showValues ? formatMoney(c) : HIDDEN);
  const signedMoney = (c: number) => (showValues ? (c > 0 ? "+" : "") + formatMoney(c) : HIDDEN);
  const eligible = s.assets.filter((a) => holdsPositions(a.category));

  return (
    <section aria-label="Investimentos">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl">Investimentos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Posições dentro dos seus itens. Com operações lançadas, o item passa a valer o que elas valem.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTargetsOpen(true)}>
            <Target size={16} aria-hidden /> Metas de alocação
          </Button>
          <Button disabled={eligible.length === 0} onClick={() => setEditing({ holding: null })}>
            <Plus size={16} aria-hidden /> Nova posição
          </Button>
        </div>
      </div>

      {v.positions.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl bg-card p-4 shadow-card">
            <dt className="text-xs text-muted-foreground">Valor das posições</dt>
            <dd className="money font-display text-2xl font-bold">{money(v.totals.marketValue)}</dd>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-card">
            <dt className="text-xs text-muted-foreground">Ganho não realizado</dt>
            <dd className={cn("money font-display text-2xl font-bold", v.totals.unrealized > 0 && "text-primary")}>{signedMoney(v.totals.unrealized)}</dd>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-card">
            <dt className="text-xs text-muted-foreground">Realizado + proventos</dt>
            <dd className="money font-display text-2xl font-bold">{signedMoney(v.totals.realized + v.totals.income)}</dd>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-card">
            <dt className="text-xs text-muted-foreground">{v.performance && !v.performance.annual ? "Rentabilidade no período" : "Rentabilidade ao ano"}</dt>
            <dd className="money font-display text-2xl font-bold">{v.performance ? signedPct(v.performance.rate) : "—"}</dd>
          </div>
        </dl>
      )}
      {v.stalePrices > 0 && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <AlertCircle size={16} className="text-primary" aria-hidden />
          {v.stalePrices === 1 ? "1 posição está" : `${v.stalePrices} posições estão`} com o preço sem atualizar há mais de um mês.
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-card p-5 shadow-card">
          <h3 className="text-base">Alocação para a aposentadoria</h3>
          {v.allocation.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Cadastre itens para a aposentadoria para ver a divisão.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {v.allocation.map((a) => (
                <li key={a.assetClass}>
                  <div className="flex justify-between gap-4 text-sm">
                    <span>{assetClassLabel(a.assetClass)}</span>
                    <span className="money text-muted-foreground">
                      {formatPercent(a.share)}
                      {a.target !== null && <span> · meta {formatPercent(a.target)}</span>}
                    </span>
                  </div>
                  <div className="relative mt-1 h-2 rounded-full bg-muted" aria-hidden>
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(a.share * 100, 100)}%` }} />
                    {a.target !== null && <div className="absolute -top-1 h-4 w-0.5 rounded bg-foreground" style={{ left: `calc(${a.target * 100}% - 1px)` }} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {!v.hasTargets && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setTargetsOpen(true)}>
              Definir metas por classe
            </Button>
          )}
        </div>
        <SuggestionCard s={s} showValues={showValues} />
      </div>

      {v.positions.length > 0 ? (
        <div className="mt-4 rounded-2xl bg-card p-5 shadow-card">
          <h3 className="text-base">Posições</h3>
          <ul className="mt-2 divide-y divide-border">
            {v.positions.map((p) => (
              <li key={p.holding.id}>
                <button
                  type="button"
                  onClick={() => setEditing({ holding: p.holding })}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 rounded-xl px-1 py-3 text-left hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{p.holding.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {assetClassLabel(p.holding.assetClass)} · {p.assetName} · {qty(p.quantity)} × preço médio {money(p.avgPrice)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="money block whitespace-nowrap text-sm font-semibold">{money(p.marketValue)}</span>
                    {p.unrealizedPct !== null && (
                      <span className={cn("money block whitespace-nowrap text-xs", p.unrealized >= 0 ? "text-primary" : "text-destructive")}>
                        {signedPct(p.unrealizedPct)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        eligible.length > 0 && (
          <p className="mt-4 rounded-2xl bg-card p-5 text-sm text-muted-foreground shadow-card">
            Quer acompanhar preço médio e ganho de cada ativo? Crie uma posição dentro de um item de investimento ou previdência.
          </p>
        )
      )}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        Os preços são os que você informa; o app não busca cotações. Ganhos não consideram impostos. Não é recomendação de investimento.
      </p>

      <HoldingSheet s={s} editing={editing} positions={v.positions} onClose={() => setEditing(null)} />
      <TargetsSheet s={s} open={targetsOpen} onClose={() => setTargetsOpen(false)} />
    </section>
  );
}

/** Onde aportar este mês. Usado no Patrimônio e na Jornada. */
export function SuggestionCard({ s, showValues, compact = false }: { s: DemoState; showValues: boolean; compact?: boolean }) {
  const sug = contributionSuggestion(s);
  const money = (c: number) => (showValues ? formatMoney(c) : HIDDEN);
  return (
    <div className="rounded-2xl bg-card p-5 shadow-card ring-1 ring-primary/40" aria-label="Onde aportar este mês">
      <p className="eyebrow">Onde aportar este mês</p>
      {!sug.hasTargets ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Defina metas de alocação por classe e o app mostra como dividir o aporte para chegar mais perto delas.{" "}
          {compact && (
            <Link to="/patrimonio" className="font-semibold text-primary hover:underline">
              Definir metas
            </Link>
          )}
        </p>
      ) : sug.amount <= 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sem aporte previsto para este mês no orçamento nem no plano.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="money font-semibold text-foreground">{money(sug.amount)}</span>{" "}
            {sug.source === "orcamento" ? "que faltam no envelope Aposentadoria" : "do aporte do plano"}, só comprando:
          </p>
          {sug.items.length === 0 ? (
            <p className="mt-2 text-sm">A carteira já está nas metas; qualquer classe serve.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {sug.items.map((i) => (
                <li key={i.assetClass} className="flex items-center justify-between gap-4 text-sm">
                  <span>
                    <span className="block font-semibold">{assetClassLabel(i.assetClass)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatPercent(i.before)} → {formatPercent(i.after)} · meta {formatPercent(i.target)}
                    </span>
                  </span>
                  <span className="money whitespace-nowrap font-semibold text-primary">{money(i.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          {compact && (
            <Link to="/patrimonio" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
              Ver carteira
            </Link>
          )}
        </>
      )}
    </div>
  );
}

function HoldingSheet({
  s,
  editing,
  positions,
  onClose,
}: {
  s: DemoState;
  editing: { holding: Holding | null } | null;
  positions: Position[];
  onClose: () => void;
}) {
  const h = editing?.holding ?? null;
  const eligible = s.assets.filter((a) => holdsPositions(a.category));
  const [assetId, setAssetId] = useState<string | undefined>(undefined);
  const [name, setName] = useState("");
  const [assetClass, setAssetClass] = useState<AssetClass>("renda_fixa");
  const [price, setPrice] = useState<number | null>(null);
  useEffect(() => {
    setAssetId(h?.assetId ?? eligible[0]?.id);
    setName(h?.name ?? "");
    setAssetClass(h?.assetClass ?? "renda_fixa");
    setPrice(h ? h.price / 100 : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  if (!editing) return null;
  const pos = h ? positions.find((p) => p.holding.id === h.id) : undefined;

  function save() {
    try {
      demo.saveHolding({ id: h?.id, assetId: assetId ?? "", name, assetClass, price: toCents(price ?? 0) });
      toast.success(h ? "Posição atualizada." : "Posição criada. Lance a primeira compra.");
      if (!h) onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-[480px] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">{h ? h.name : "Nova posição"}</SheetTitle>
          <SheetDescription>
            {pos
              ? `${qty(pos.quantity)} unidades · preço médio ${formatMoney(pos.avgPrice)} · preço atualizado em ${formatDate(h!.priceUpdatedAt)}`
              : "Um ativo dentro de um item do Patrimônio: um título, uma ação, um fundo."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4 pb-4">
          <div>
            <p className="text-sm font-semibold">Item do Patrimônio</p>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl bg-muted" aria-label="Item do Patrimônio">
                <SelectValue placeholder="Escolha o item" />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="holding-name" className="text-sm font-semibold">
              Nome ou código
            </label>
            <Input id="holding-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11" placeholder="Ex.: Tesouro IPCA+ 2035, BOVA11" />
          </div>
          <div role="radiogroup" aria-label="Classe" className="flex flex-wrap gap-2">
            {ASSET_CLASSES.map((c) => (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={assetClass === c.key}
                onClick={() => setAssetClass(c.key)}
                className={cn("min-h-10 rounded-full border px-4 text-sm", assetClass === c.key ? "border-primary font-semibold text-primary" : "border-border")}
              >
                {c.label}
              </button>
            ))}
          </div>
          <NumberField label="Preço atual por unidade" value={price} onChange={setPrice} prefix="R$" min={0} step={0.01} hint="Atualize quando quiser; o valor do item acompanha." />
          <Button className="w-full" onClick={save}>
            {h ? "Salvar posição" : "Criar posição"}
          </Button>
          {h && <TradeForm holdingId={h.id} />}
          {pos && pos.trades.length > 0 && (
            <div>
              <p className="text-sm font-semibold">Operações</p>
              <ul className="mt-1.5 divide-y divide-border text-sm">
                {pos.trades.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <span className="block font-semibold capitalize">{t.type}</span>
                      <span className="block text-xs text-muted-foreground">
                        {dayLabel(t.date)}
                        {t.type !== "provento" && ` · ${qty(t.quantity)} × ${formatMoney(t.unitPrice)}`}
                        {t.fees > 0 && ` · taxas ${formatMoney(t.fees)}`}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="money whitespace-nowrap">
                        {formatMoney(t.type === "provento" ? t.unitPrice : Math.round(t.quantity * t.unitPrice))}
                      </span>
                      <button
                        type="button"
                        aria-label="Excluir operação"
                        onClick={() => {
                          try {
                            demo.deleteTrade(t.id);
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {h && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                demo.deleteHolding(h.id);
                toast("Posição removida com as operações dela.");
                onClose();
              }}
            >
              Remover posição
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function TradeForm({ holdingId }: { holdingId: string }) {
  const [type, setType] = useState<TradeType>("compra");
  const [date, setDate] = useState(spDate(new Date()));
  const [quantity, setQuantity] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [fees, setFees] = useState<number | null>(null);

  function add() {
    try {
      const r = demo.addTrade({ holdingId, date, type, quantity: quantity ?? 0, unitPrice: toCents(price ?? 0), fees: toCents(fees ?? 0) });
      xpToast(type === "provento" ? "Provento lançado." : type === "compra" ? "Compra lançada." : "Venda lançada.", r.xpAwarded);
      handleResult(r);
      setQuantity(null);
      setPrice(null);
      setFees(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-muted p-4">
      <p className="text-sm font-semibold">Lançar operação</p>
      <Segmented
        label="Operação"
        value={type}
        onChange={setType}
        options={[
          { value: "compra", label: "Compra" },
          { value: "venda", label: "Venda" },
          { value: "provento", label: "Provento" },
        ]}
      />
      <div>
        <label htmlFor="trade-date" className="text-sm font-semibold">
          Data
        </label>
        <Input id="trade-date" type="date" value={date} max={spDate(new Date())} onChange={(e) => setDate(e.target.value)} className="mt-1.5 h-11 bg-card" />
      </div>
      {type !== "provento" && <NumberField label="Quantidade" value={quantity} onChange={setQuantity} min={0} />}
      <NumberField label={type === "provento" ? "Valor recebido" : "Preço por unidade"} value={price} onChange={setPrice} prefix="R$" min={0} step={0.01} />
      {type !== "provento" && <NumberField label="Taxas" value={fees} onChange={setFees} prefix="R$" min={0} step={0.01} optional />}
      <Button variant="outline" className="w-full" onClick={add}>
        Lançar
      </Button>
    </div>
  );
}

function TargetsSheet({ s, open, onClose }: { s: DemoState; open: boolean; onClose: () => void }) {
  const [targets, setTargets] = useState<Partial<Record<AssetClass, number | null>>>({});
  useEffect(() => {
    if (open) setTargets({ ...s.allocationTargets });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;
  const sum = Object.values(targets).reduce<number>((a, v) => a + (v ?? 0), 0);

  function save() {
    try {
      const r = demo.setAllocationTargets(Object.fromEntries(Object.entries(targets).map(([k, v]) => [k, v ?? 0])) as Partial<Record<AssetClass, number>>);
      toast.success("Metas de alocação salvas.");
      handleResult(r);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-[480px] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">Metas de alocação</SheetTitle>
          <SheetDescription>Quanto de cada classe você quer ter no que é para a aposentadoria. As metas precisam somar 100%.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3 pb-4">
          {ASSET_CLASSES.map((c) => (
            <NumberField key={c.key} label={c.label} value={targets[c.key] ?? null} onChange={(v) => setTargets((t) => ({ ...t, [c.key]: v }))} suffix="%" min={0} max={100} step={1} />
          ))}
          <p className={cn("text-sm font-semibold", Math.abs(sum - 100) <= 0.01 ? "text-primary" : "text-muted-foreground")}>Soma: {sum.toLocaleString("pt-BR")}%</p>
          <Button className="w-full" onClick={save}>
            Salvar metas
          </Button>
          {Object.keys(s.allocationTargets).length > 0 && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                demo.setAllocationTargets({});
                onClose();
              }}
            >
              Apagar metas
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
