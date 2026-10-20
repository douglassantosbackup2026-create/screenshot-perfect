import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Plus } from "lucide-react";
import { toast } from "sonner";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NumberField } from "@/components/forms";
import { handleResult, xpToast } from "@/components/feedback";
import { HIDDEN } from "@/components/dashboard";
import { ASSET_CATEGORIES, categoryLabel, isIncomeSource, isLiability, summarizeAssets, type AssetCategory } from "@/lib/calc/assets";
import { formatMoney, formatMonthly, formatWealth } from "@/lib/calc/format";
import type { HistoryPoint } from "@/lib/calc/networth";
import { demo, linkedAccountOf, useDemo, valuedByHoldings, type Asset } from "@/lib/data/demo-store";
import { PortfolioSection } from "@/components/portfolio/PortfolioSection";
import { AreaTabs } from "@/components/nav/areas";
import { PlanGate } from "@/components/PlanGate";
import { assetHistories, hasWealthRecord } from "@/lib/data/selectors";
import { formatDate, monthYear } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/patrimonio")({
  validateSearch: (s: Record<string, unknown>): { novo?: boolean } => (s["novo"] ? { novo: true } : {}),
  head: () => ({
    meta: [
      { title: "Patrimônio — Previdência Intelligence" },
      { name: "description", content: "Seus ativos, dívidas e fontes de renda, separando o que é para a aposentadoria." },
      { property: "og:title", content: "Patrimônio — Previdência Intelligence" },
      { property: "og:description", content: "Seus ativos, dívidas e fontes de renda, separando o que é para a aposentadoria." },
    ],
  }),
  component: Wealth,
});

type Editing = { asset: Asset | null } | null;

function Wealth() {
  const s = useDemo();
  const { novo } = Route.useSearch();
  const navigate = useNavigate();
  const [showValues, setShowValues] = useState(!s.profile.hideValues);
  const [editing, setEditing] = useState<Editing>(null);

  useEffect(() => {
    if (novo) {
      setEditing({ asset: null });
      navigate({ to: "/patrimonio", search: {}, replace: true });
    }
  }, [novo, navigate]);

  const sum = summarizeAssets(s.assets);
  const histories = assetHistories(s);
  const money = (v: number, fmt = formatWealth) => (showValues ? fmt(v) : HIDDEN);
  const planWealth = s.plan?.inputs.initialWealth ?? null;
  const differs = planWealth != null && s.assets.length > 0 && Math.abs(sum.retirementTotal - planWealth) >= 1;
  // Quando a diferença some no arredondamento para R$ 1.000, mostra os valores exatos para não dizer "10.000 é diferente de 10.000".
  const exact = (v: number) => formatMoney(Math.round(v * 100));
  const cmpFmt = differs && formatWealth(sum.retirementTotal) === formatWealth(planWealth ?? 0) ? exact : formatWealth;

  const groups: { title: string; hint: string; items: Asset[]; total: string }[] = [
    {
      title: "Para a aposentadoria",
      hint: "Entra no cálculo do plano.",
      items: s.assets.filter((a) => a.forRetirement && !isLiability(a.category) && !isIncomeSource(a.category)),
      total: money(sum.retirementTotal),
    },
    {
      title: "Outros ativos",
      hint: "Você não pretende usar para a aposentadoria. Fica de fora do plano.",
      items: s.assets.filter((a) => !a.forRetirement && !isLiability(a.category) && !isIncomeSource(a.category)),
      total: money(sum.otherTotal),
    },
    {
      title: "Rendas futuras",
      hint: "Benefícios e outras rendas mensais estimadas. Valores por mês.",
      items: s.assets.filter((a) => isIncomeSource(a.category)),
      total: money(sum.incomeSourcesMonthly, formatMonthly) + "/mês",
    },
    {
      title: "Dívidas e obrigações",
      hint: "Mostradas à parte; não são descontadas de nenhum outro total.",
      items: s.assets.filter((a) => isLiability(a.category)),
      total: money(sum.debtsTotal),
    },
  ];

  function applyToPlan() {
    if (!s.plan) return;
    const r = demo.savePlan({ ...s.plan.inputs, initialWealth: sum.retirementTotal }, "edit");
    xpToast("Plano atualizado com o patrimônio cadastrado.", r.xpAwarded);
    handleResult(r);
  }

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-8 lg:max-w-4xl lg:px-8 lg:pb-12">
      <AreaTabs />
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1>Patrimônio</h1>
          <p className="mt-1 text-sm text-muted-foreground">O que você informou, item a item. Só você vê estes números.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowValues((v) => !v)}
            className="flex min-h-11 items-center gap-2 rounded-full bg-card px-4 text-sm text-muted-foreground shadow-card hover:text-foreground"
            aria-pressed={showValues}
          >
            {showValues ? <EyeOff size={16} strokeWidth={1.75} aria-hidden /> : <Eye size={16} strokeWidth={1.75} aria-hidden />}
            {showValues ? "Ocultar valores" : "Mostrar valores"}
          </button>
          <Button onClick={() => setEditing({ asset: null })}>
            <Plus size={16} strokeWidth={2} aria-hidden /> Adicionar item
          </Button>
        </div>
      </header>

      <section className="mt-6 rounded-3xl bg-card p-6 shadow-card">
        <p className="text-sm text-muted-foreground">Para a aposentadoria</p>
        <p className="money font-display text-4xl font-semibold text-primary">{money(sum.retirementTotal, cmpFmt)}</p>
        {planWealth != null && (
          <p className="mt-2 text-sm text-muted-foreground">
            O plano usa <span className="money">{money(planWealth, cmpFmt)}</span>.{" "}
            {differs ? "Os valores estão diferentes." : s.assets.length ? "Está tudo alinhado." : ""}
          </p>
        )}
        {differs && (
          <Button variant="outline" className="mt-4 w-full" onClick={applyToPlan}>
            Usar {money(sum.retirementTotal, cmpFmt)} no plano
          </Button>
        )}
        {s.assets.length > 0 && !hasWealthRecord(s) && (
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link to="/evolucao" search={{ registrar: true }}>
              Registrar o patrimônio deste mês
            </Link>
          </Button>
        )}
      </section>

      {s.assets.length === 0 ? (
        <section className="mt-4 rounded-2xl bg-card p-6 text-center shadow-card">
          <p className="font-semibold">Nenhum item cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Comece pela previdência e pelos investimentos. Imóveis, reserva, benefícios e dívidas são opcionais.
          </p>
          <Button className="mt-4" onClick={() => setEditing({ asset: null })}>
            Adicionar o primeiro item
          </Button>
        </section>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.title} className="rounded-2xl bg-card p-5 shadow-card" aria-label={g.title}>
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-lg">{g.title}</h2>
                  <span className="money text-sm font-semibold">{g.total}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{g.hint}</p>
                <ul className="mt-3 divide-y divide-border">
                  {g.items.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setEditing({ asset: a })}
                        className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-3 text-left hover:bg-muted"
                      >
                        <span>
                          <span className="block font-semibold">{a.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {categoryLabel(a.category)} · atualizado em {formatDate(a.updatedAt)}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3">
                          <Sparkline points={histories.get(a.id) ?? []} />
                          <span className="money text-sm">{isIncomeSource(a.category) ? money(a.value, formatMonthly) + "/mês" : money(a.value)}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}

      <div className="mt-8">
        <PlanGate feature="investimentos" hasData={s.holdings.length > 0 || Object.keys(s.allocationTargets).length > 0}>
          <PortfolioSection s={s} showValues={showValues} />
        </PlanGate>
      </div>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Crescimento do patrimônio informado não é o mesmo que rendimento: aportes, retiradas, valorização e atualização dos dados mexem no total de
        jeitos diferentes. Os valores são os que você informou, sem conferência com instituições.
      </p>

      <AssetSheet
        editing={editing}
        history={editing?.asset ? (histories.get(editing.asset.id) ?? []) : []}
        fromHoldings={!!editing?.asset && valuedByHoldings(s, editing.asset.id)}
        linkedTo={editing?.asset ? (linkedAccountOf(s, editing.asset.id)?.name ?? null) : null}
        onClose={() => setEditing(null)}
      />
    </main>
  );
}

/** Tendência do item nos meses registrados; só aparece com dois valores ou mais. */
function Sparkline({ points }: { points: HistoryPoint[] }) {
  if (points.length < 2) return null;
  return (
    <span className="block h-6 w-16" aria-hidden>
      <ResponsiveContainer>
        <LineChart data={points.slice(-12)} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={1.75} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </span>
  );
}

// Variações costumam ser pequenas: arredonda para R$ 10, não para R$ 1.000 como o saldo.
const signed = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "") + formatMonthly(Math.abs(v));

function AssetSheet({
  editing,
  history,
  fromHoldings,
  linkedTo,
  onClose,
}: {
  editing: Editing;
  history: HistoryPoint[];
  fromHoldings: boolean;
  /** Nome da conta do livro-caixa ligada a este item, se houver. */
  linkedTo: string | null;
  onClose: () => void;
}) {
  const asset = editing?.asset ?? null;
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AssetCategory>("pgbl");
  const [value, setValue] = useState<number | null>(null);
  const [forRetirement, setForRetirement] = useState(true);
  const [note, setNote] = useState("");
  useEffect(() => {
    setName(asset?.name ?? "");
    setCategory(asset?.category ?? "pgbl");
    setValue(asset?.value ?? null);
    setForRetirement(asset?.forRetirement ?? true);
    setNote(asset?.note ?? "");
  }, [editing, asset]);
  if (!editing) return null;

  const monthly = isIncomeSource(category);
  const liability = isLiability(category);

  function save() {
    try {
      demo.saveAsset({ id: asset?.id, name, category, value: value ?? NaN, forRetirement, note: note.trim() || null });
      toast.success(asset ? "Item atualizado." : "Item adicionado.");
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-h-[90vh] max-w-[480px] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl font-semibold">{asset ? "Editar item" : "Novo item"}</SheetTitle>
          <SheetDescription>Informe o valor de hoje. Cadastrar itens não dá XP.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4 pb-4">
          <div>
            <label htmlFor="asset-name" className="text-sm font-semibold">
              Nome
            </label>
            <Input id="asset-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11" placeholder="Ex.: PGBL do banco" />
          </div>
          <div role="radiogroup" aria-label="Categoria" className="flex flex-wrap gap-2">
            {ASSET_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={category === c.key}
                onClick={() => setCategory(c.key)}
                className={cn(
                  "min-h-10 rounded-full border px-4 text-sm",
                  category === c.key ? "border-primary font-semibold text-primary" : "border-border",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          {linkedTo ? (
            <p className="rounded-xl bg-muted p-4 text-sm">
              Valor atual: <span className="money font-semibold">{formatWealth(value ?? 0)}</span>. Vem do saldo da conta “{linkedTo}” no livro-caixa; para mudar,
              lance ou transfira nessa conta.
            </p>
          ) : fromHoldings ? (
            <p className="rounded-xl bg-muted p-4 text-sm">
              Valor atual: <span className="money font-semibold">{formatWealth(value ?? 0)}</span>. Vem das posições de investimento deste item; para
              mudar, lance operações ou atualize os preços em Investimentos.
            </p>
          ) : (
            <NumberField
              label={monthly ? "Valor mensal estimado" : liability ? "Saldo devedor" : "Valor atual"}
              value={value}
              onChange={setValue}
              prefix="R$"
              min={0}
            />
          )}
          {!monthly && !liability && (
            <label className="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-muted px-4">
              <span className="text-sm">Pretendo usar na aposentadoria</span>
              <Switch checked={forRetirement} onCheckedChange={setForRetirement} />
            </label>
          )}
          <div>
            <label htmlFor="asset-note" className="text-sm font-semibold">
              Observações <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Textarea id="asset-note" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5" />
          </div>
          {history.length > 0 && (
            <div>
              <p className="text-sm font-semibold">Histórico</p>
              <ul className="mt-1.5 divide-y divide-border text-sm" aria-label="Histórico do item">
                {history
                  .slice(-6)
                  .reverse()
                  .map((p) => (
                    <li key={p.month} className="flex items-center justify-between gap-4 py-2">
                      <span className="text-muted-foreground">{monthYear(p.month)}</span>
                      <span className="money">
                        {formatWealth(p.value)}
                        {p.delta !== null && p.delta !== 0 && <span className="ml-2 text-xs text-muted-foreground">{signed(p.delta)}</span>}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          <Button className="w-full" onClick={save}>
            {asset ? "Salvar alterações" : "Adicionar"}
          </Button>
          {asset && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                demo.deleteAsset(asset.id);
                toast("Item removido.");
                onClose();
              }}
            >
              Remover item
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
