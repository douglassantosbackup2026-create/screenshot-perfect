import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo";
import { JOURNEY_ENABLED } from "@/lib/features";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, GRID, TOOLTIP_STYLE } from "@/components/chart-theme";
import { toast } from "sonner";
import { ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NumberField, Segmented, LegalNote } from "@/components/forms";
import { handleResult, xpToast } from "@/components/feedback";
import { AreaTabs } from "@/components/nav/areas";
import { WhatIfSheet } from "@/components/plan/WhatIf";
import { GoalSeekCard } from "@/components/plan/GoalSeek";
import { PensionTaxCard } from "@/components/plan/PensionTax";
import { ENGINE_VERSION, projectSeries, sensitivity, simulateAll, validateInputs, type PlanInputs, type ScenarioKey } from "@/lib/calc/retirement";
import { summarizeAssets } from "@/lib/calc/assets";
import { sinceLastReview } from "@/lib/data/selectors";
import { formatAge, formatMonthly, formatPercent, formatWealth } from "@/lib/calc/format";
import { demo, inputsFromProfile, planAgeDays, useDemo, type SnapshotReason } from "@/lib/data/demo-store";
import { formatDate, INSS_HELP, REASON_LABEL, SIMULATION_FOOTER } from "@/lib/labels";

export const Route = createFileRoute("/_authenticated/plano")({
  validateSearch: (s: Record<string, unknown>): { criar?: boolean } => (s["criar"] ? { criar: true } : {}),
  head: () => pageHead("Plano", "Seu plano de aposentadoria em três cenários, com premissas visíveis e editáveis.", "Seu plano de aposentadoria em três cenários, com premissas visíveis."),
  component: PlanPage,
});

const SCEN: { value: ScenarioKey; label: string }[] = [
  { value: "conservador", label: "Conservador" },
  { value: "central", label: "Central" },
  { value: "otimista", label: "Otimista" },
];
const LIFE_REASONS = ["Renda", "Família", "Trabalho", "Cidade", "Outro"];

function PlanPage() {
  const s = useDemo();
  const { criar } = Route.useSearch();
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (criar && !s.plan) setCreating(true);
  }, [criar, s.plan]);

  if (!s.plan && !creating) {
    return (
      <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-8 lg:max-w-3xl lg:px-8 lg:pb-12">
        <AreaTabs />
        <h1>Seu plano</h1>
        <p className="mt-4">{JOURNEY_ENABLED ? "Seu plano fica pronto na Unidade 2 da jornada. Quer montar agora?" : "Você ainda não tem um plano. Leva poucos minutos: quer montar agora?"}</p>
        <Button className="mt-6 w-full" onClick={() => setCreating(true)}>
          Montar meu plano
        </Button>
      </main>
    );
  }
  return <PlanView initial={s.plan?.inputs ?? inputsFromProfile(s.profile)} isNew={!s.plan} />;
}

function PlanView({ initial, isNew }: { initial: PlanInputs; isNew: boolean }) {
  const s = useDemo();
  const [draft, setDraft] = useState<PlanInputs>(initial);
  const [scenario, setScenario] = useState<ScenarioKey>("central");
  const [withInss, setWithInss] = useState<"sem" | "com">("sem");
  const [editOpen, setEditOpen] = useState(isNew);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [lifeOpen, setLifeOpen] = useState(false);
  const [lifeReason, setLifeReason] = useState<string | null>(null);
  const [whatIfOpen, setWhatIfOpen] = useState(false);

  // Volta ao plano salvo só quando ele muda de verdade. `initial` é um objeto novo a cada mudança no
  // store (um lançamento pelo "+", uma gravação), e depender dele apagava o que a pessoa estava editando.
  const savedVersion = s.plan?.updatedAt ?? null;
  useEffect(() => {
    setDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedVersion]);

  const errors = validateInputs(draft);
  const all = useMemo(() => (errors.length ? null : simulateAll(draft)), [draft, errors.length]);
  const hasInss = !!draft.inssEstimate && draft.inssEstimate > 0;
  const includeInss = withInss === "com" && hasInss;
  const r = all ? (includeInss ? all.comInss![scenario] : all.semInss[scenario]) : null;
  const series = useMemo(() => (all ? projectSeries(draft, scenario, includeInss) : []), [all, draft, scenario, includeInss]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(s.plan?.inputs);
  const annualAvailable = s.plan ? planAgeDays(s.plan.createdAt) >= 180 : false;

  function save(reason: SnapshotReason, life?: string) {
    if (errors.length) {
      toast.error(errors[0]);
      return;
    }
    const res = demo.savePlan(draft, reason, life);
    xpToast(isNew ? "Plano salvo." : reason === "quick_review" ? "Revisão feita." : "Plano salvo.", res.xpAwarded);
    handleResult(res);
    setEditOpen(false);
    setQuickOpen(false);
    setLifeOpen(false);
    setLifeReason(null);
  }

  function saveWhatIf(inputs: PlanInputs) {
    const res = demo.savePlan(inputs, "what_if");
    xpToast("Plano atualizado com a simulação.", res.xpAwarded);
    handleResult(res);
    setWhatIfOpen(false);
  }

  const set = <K extends keyof PlanInputs>(k: K) => (v: PlanInputs[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setPct = (k: "inflationAA" | "costsAA") => (v: number | null) => setDraft((d) => ({ ...d, [k]: (v ?? 0) / 100 }));
  const setRet = (k: ScenarioKey) => (v: number | null) => setDraft((d) => ({ ...d, returns: { ...d.returns, [k]: (v ?? 0) / 100 } }));

  const central = all?.semInss.central;
  const sens = useMemo(() => (all ? sensitivity(draft, scenario, includeInss) : []), [all, draft, scenario, includeInss]);
  const assetsForRetirement = s.assets.length ? summarizeAssets(s.assets).retirementTotal : null;
  const review = sinceLastReview(s);

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-8 lg:max-w-6xl lg:px-8 lg:pb-12">
      <AreaTabs />
      <h1>Seu plano</h1>

      {dirty && s.plan && (
        <div role="status" className="sticky top-2 z-20 mt-4 flex items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-card">
          <span className="text-sm font-semibold">Alterações não salvas</span>
          <span className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-black/10" onClick={() => setDraft(initial)}>
              Descartar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => save("edit")}>
              Salvar
            </Button>
          </span>
        </div>
      )}

      {/* No celular, uma coluna na ordem do código; no desktop, resumo à esquerda e gráfico à direita. */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[5fr_7fr] lg:items-start lg:gap-x-6 lg:[grid-template-areas:'res_chart'_'seg_chart'_'pre_chart'_'calc_hist'_'rev_hist'_'sens_hist']">
      <div className="lg:[grid-area:res]">
      {r && central && (
        <section className="rounded-3xl bg-card p-6 shadow-card" aria-live="polite">
          <p className="text-lg leading-7">
            Para chegar lá, guarde cerca de{" "}
            <strong className="money block font-display text-4xl font-semibold text-primary">{formatMonthly(r.requiredMonthlyContribution)}</strong>{" "}
            por mês.
          </p>
          <p className="mt-3 text-muted-foreground">
            Hoje você guarda <span className="money">{formatMonthly(draft.monthlyContribution)}</span>.{" "}
            {r.depletionAge == null
              ? `Nesse ritmo, o dinheiro dura até os ${draft.horizonAge} anos.`
              : `Nesse ritmo, o dinheiro duraria até cerca de ${formatAge(r.depletionAge)}.`}
          </p>
        </section>
      )}
      {r && (
        <section className="mt-4 rounded-2xl bg-card p-5 shadow-card" aria-label="De onde vem o patrimônio projetado">
          <h2 className="text-base">De onde vem o patrimônio aos {draft.retirementAge} anos</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Patrimônio de hoje, rendendo</dt>
              <dd className="money">{formatWealth(r.fvFromInitial)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Aportes mensais, rendendo</dt>
              <dd className="money">{formatWealth(r.fvFromContributions)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
              <dt>Estimativa total</dt>
              <dd className="money">{formatWealth(r.projectedWealthAtRetirement)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-muted-foreground">
            Renda que esse patrimônio sustentaria: cerca de <span className="money">{formatMonthly(r.sustainableMonthlyIncome)}</span> por mês. Diferença
            estimada até o patrimônio necessário:{" "}
            <span className="money">{r.gap > 0 ? formatWealth(r.gap) : "nenhuma neste cenário"}</span>.
          </p>
        </section>
      )}
      {r && !isNew && s.plan && (
        <Button variant="outline" className="mt-4 w-full" onClick={() => setWhatIfOpen(true)}>
          <Sparkles size={16} strokeWidth={1.75} aria-hidden />
          E se…?
        </Button>
      )}
      {r && (
        <GoalSeekCard
          inputs={draft}
          scenario={scenario}
          includeInss={includeInss}
          onUseAge={(age) => {
            set("retirementAge")(age);
            setEditOpen(true);
            toast("Idade alterada nas premissas. Salve o plano se quiser manter.");
          }}
        />
      )}
      {s.plan && <PensionTaxCard inputs={s.plan.inputs} />}
      {errors.length > 0 && <p className="mt-6 text-sm text-destructive">{errors[0]}</p>}
      </div>

      <div className="space-y-3 lg:[grid-area:seg]">
        <Segmented
          label="Considerar INSS"
          value={withInss}
          onChange={(v) => {
            if (v === "com" && !hasInss) {
              setEditOpen(true);
              toast("Adicione a estimativa do Meu INSS nas premissas.");
              return;
            }
            setWithInss(v);
          }}
          options={[
            { value: "sem", label: "Sem INSS" },
            { value: "com", label: hasInss ? "Com minha estimativa do INSS" : "Adicionar estimativa do Meu INSS" },
          ]}
        />
        <Segmented label="Cenário" value={scenario} onChange={setScenario} options={SCEN} />
      </div>

      {r && (
        <section className="rounded-2xl bg-card p-5 shadow-card lg:[grid-area:chart]" aria-label="Gráfico do patrimônio">
          <figure>
            <div className="h-56 w-full" aria-hidden>
              <ResponsiveContainer>
                <AreaChart data={series} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="age" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                  <YAxis
                    width={48}
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)} mi` : `${Math.round(v / 1e3)} mil`)}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatWealth(v), "Patrimônio"]}
                    labelFormatter={(a) => `${a} anos`}
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Area type="monotone" dataKey="wealth" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.12} strokeWidth={2} isAnimationActive={false} />
                  <ReferenceLine x={draft.retirementAge} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                  <ReferenceDot x={draft.retirementAge} y={r.targetWealth} r={5} fill="var(--card)" stroke="var(--primary)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <figcaption className="mt-2 text-sm text-muted-foreground">
              Com o aporte de hoje, o patrimônio chega a cerca de {formatWealth(r.projectedWealthAtRetirement)} aos {draft.retirementAge} anos. O
              alvo para pagar a renda até os {draft.horizonAge} é cerca de {formatWealth(r.targetWealth)} (ponto no gráfico). Em valores nominais,
              com inflação de {formatPercent(draft.inflationAA)}, seriam cerca de {formatWealth(r.projectedWealthNominal)}.
            </figcaption>
          </figure>
          <p className="mt-3 rounded-xl bg-muted p-3 text-sm">
            Retorno real {formatPercent(draft.returns[scenario])} ao ano · horizonte {draft.horizonAge} anos · custos {formatPercent(draft.costsAA)} ao ano ·{" "}
            {includeInss ? `com INSS de ${formatMonthly(draft.inssEstimate!)}` : "sem INSS"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {s.plan ? `Premissas salvas em ${formatDate(s.plan.updatedAt)}` : "Premissas ainda não salvas"} · motor {ENGINE_VERSION}
            {dirty && s.plan ? " · você está vendo alterações não salvas" : ""}
          </p>
        </section>
      )}

      <Collapsible open={editOpen} onOpenChange={setEditOpen} className="rounded-2xl bg-card shadow-card lg:[grid-area:pre]">
        <CollapsibleTrigger className="flex min-h-12 w-full items-center justify-between px-5 font-semibold">
          Premissas
          <ChevronDown size={18} strokeWidth={1.75} className={editOpen ? "rotate-180" : ""} aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 px-5 pb-5">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Idade atual" value={draft.currentAge} onChange={(v) => set("currentAge")(v ?? 0)} suffix="anos" help="Sua idade em anos completos." />
            <NumberField label="Aposentar aos" value={draft.retirementAge} onChange={(v) => set("retirementAge")(v ?? 0)} suffix="anos" help="A idade em que você quer parar de depender do trabalho." />
          </div>
          <NumberField label="Horizonte" value={draft.horizonAge} onChange={(v) => set("horizonAge")(v ?? 0)} suffix="anos" help="Até que idade o dinheiro precisa durar. O padrão é 95 anos." />
          <div>
            <NumberField label="Patrimônio atual" value={draft.initialWealth} onChange={(v) => set("initialWealth")(v ?? 0)} prefix="R$" help="Quanto você já guardou para a aposentadoria." />
            {assetsForRetirement != null && Math.abs(assetsForRetirement - draft.initialWealth) >= 1 && (
              <button type="button" className="mt-1 text-sm text-primary underline-offset-4 hover:underline" onClick={() => set("initialWealth")(assetsForRetirement)}>
                Usar <span className="money">{formatWealth(assetsForRetirement)}</span> do seu patrimônio cadastrado
              </button>
            )}
          </div>
          <NumberField label="Aporte mensal" value={draft.monthlyContribution} onChange={(v) => set("monthlyContribution")(v ?? 0)} prefix="R$" help="Quanto você guarda por mês hoje." />
          <NumberField label="Renda desejada" value={draft.desiredMonthlyIncome} onChange={(v) => set("desiredMonthlyIncome")(v ?? 0)} prefix="R$" help="Quanto você quer ter por mês, em valores de hoje." />
          <NumberField label="Estimativa do INSS" value={draft.inssEstimate} onChange={set("inssEstimate")} prefix="R$" optional help={INSS_HELP} />
          <div className="grid grid-cols-3 gap-2">
            {SCEN.map((sc) => (
              <NumberField
                key={sc.value}
                label={sc.label}
                value={round2(draft.returns[sc.value] * 100)}
                onChange={setRet(sc.value)}
                suffix="%"
                step={0.5}
              />
            ))}
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">Retorno real ao ano, acima da inflação, em cada cenário.</p>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Inflação" value={round2(draft.inflationAA * 100)} onChange={setPct("inflationAA")} suffix="%" step={0.5} help="Usada só para mostrar o valor nominal." />
            <NumberField label="Custos anuais" value={round2(draft.costsAA * 100)} onChange={setPct("costsAA")} suffix="%" step={0.1} help="Taxas que você paga por ano. Reduzem o retorno." />
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={() => save("edit")} disabled={!dirty && !isNew}>
              Salvar plano
            </Button>
            {!isNew && dirty && (
              <Button variant="outline" onClick={() => setDraft(initial)}>
                Desfazer
              </Button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible className="rounded-2xl bg-card shadow-card lg:[grid-area:calc]">
        <CollapsibleTrigger className="flex min-h-12 w-full items-center justify-between px-5 font-semibold">
          Como calculamos
          <ChevronDown size={18} strokeWidth={1.75} aria-hidden />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 px-5 pb-5 text-sm text-muted-foreground">
          <p>Tudo está em reais de hoje, já descontada a inflação. O valor nominal aparece só como informação.</p>
          <p>Cada cenário usa um retorno real anual. Os custos que você informar reduzem esse retorno.</p>
          <p>Os aportes e as retiradas acontecem no fim de cada mês, com a taxa mensal equivalente.</p>
          <p>O patrimônio-alvo é o valor que paga sua renda até o horizonte, consumindo o dinheiro aos poucos.</p>
          <p>O cenário padrão não conta com o INSS. Impostos não são considerados.</p>
          <p>Valores mensais são arredondados para R$ 10 e patrimônios para R$ 1.000, porque a estimativa não tem precisão maior que isso.</p>
          <p>A inflação não muda o resultado em reais de hoje: ela só converte o patrimônio para valores nominais. O que move o resultado é o retorno acima da inflação.</p>
          <p>Versão do motor de cálculo: {ENGINE_VERSION}.</p>
        </CollapsibleContent>
      </Collapsible>

      {!isNew && (
        <section className="lg:[grid-area:rev]">
          <Button variant="outline" className="w-full" onClick={() => setReviewOpen(true)}>
            Revisar plano
          </Button>
        </section>
      )}

      {sens.length > 0 && (
        <section className="rounded-2xl bg-card p-5 shadow-card lg:[grid-area:sens]" aria-label="O que mais muda o resultado">
          <h2 className="text-lg">O que mais muda o resultado</h2>
          <p className="mt-1 text-sm text-muted-foreground">Mudando uma coisa por vez, no cenário {scenario}. Variação na renda mensal sustentável.</p>
          <ul className="mt-3 divide-y divide-border">
            {sens.map((it) => (
              <li key={it.key} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span>{it.label}</span>
                <span className={"money " + (it.deltaSustainableIncome >= 0 ? "text-primary" : "text-muted-foreground")}>
                  {it.deltaSustainableIncome >= 0 ? "+" : "−"}
                  {formatMonthly(Math.abs(it.deltaSustainableIncome))}/mês
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.snapshots.length > 0 && (
        <section className="rounded-2xl bg-card p-5 shadow-card lg:[grid-area:hist]">
          <h2 className="text-lg">Histórico</h2>
          {review && (
            <div className="mt-3 rounded-xl bg-muted p-3 text-sm">
              <p className="font-semibold">Desde a revisão de {formatDate(review.since)}</p>
              <p className="mt-1 text-muted-foreground">
                Rumo à independência: {formatPercent(review.coverageBefore)} → {formatPercent(review.coverageNow)}. Renda sustentável estimada{" "}
                {review.deltaSustainableIncome >= 0 ? "subiu" : "caiu"} <span className="money">{formatMonthly(Math.abs(review.deltaSustainableIncome))}</span> por
                mês. A mudança vem das premissas que você alterou, não de rendimento.
              </p>
            </div>
          )}
          <ul className="mt-3 divide-y divide-border">
            {s.snapshots.map((sn) => (
              <li key={sn.id} className="flex items-center justify-between py-3 text-sm">
                <span>
                  {formatDate(sn.createdAt)} · {REASON_LABEL[sn.reason]}
                  {sn.lifeReason ? ` (${sn.lifeReason.toLowerCase()})` : ""}
                </span>
                <span className="money text-muted-foreground">{formatMonthly(sn.requiredCentralSemInss)}/mês</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      </div>

      <footer className="mt-10 border-t border-border pt-6">
        <LegalNote>{SIMULATION_FOOTER}</LegalNote>
      </footer>

      {s.plan && (
        <WhatIfSheet base={s.plan.inputs} scenario={scenario} includeInss={includeInss} open={whatIfOpen} onOpenChange={setWhatIfOpen} onSave={saveWhatIf} />
      )}

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar plano</DialogTitle>
            <DialogDescription>Escolha o tipo de revisão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {[
              { label: "Revisão rápida", hint: "Confirmar que as premissas ainda valem", go: () => setQuickOpen(true) },
              { label: "Mudou algo na sua vida", hint: "Renda, família, trabalho ou cidade", go: () => setLifeOpen(true) },
              ...(annualAvailable
                ? [{ label: "Revisão anual", hint: "Registrar a revisão completa do ano", go: () => save("annual_review") }]
                : []),
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => {
                  setReviewOpen(false);
                  o.go();
                }}
                className="block min-h-14 w-full rounded-2xl bg-muted px-4 py-3 text-left hover:bg-muted/70"
              >
                <span className="block font-semibold">{o.label}</span>
                <span className="block text-sm text-muted-foreground">{o.hint}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisão rápida</DialogTitle>
            <DialogDescription>Confira se as premissas ainda valem para você.</DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            <li>Aposentar aos {draft.retirementAge} anos</li>
            <li>Renda desejada: <span className="money">{formatMonthly(draft.desiredMonthlyIncome)}</span></li>
            <li>Aporte atual: <span className="money">{formatMonthly(draft.monthlyContribution)}</span></li>
            <li>Retorno central: {formatPercent(draft.returns.central)} ao ano</li>
            <li>{hasInss ? `INSS informado: ${formatMonthly(draft.inssEstimate!)}` : "Sem estimativa do INSS"}</li>
          </ul>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setQuickOpen(false); setEditOpen(true); }}>
              Ajustar premissas
            </Button>
            <Button onClick={() => save("quick_review")}>Confirmar premissas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lifeOpen} onOpenChange={setLifeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mudou algo na sua vida?</DialogTitle>
            <DialogDescription>Escolha o motivo, ajuste as premissas e salve.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Motivo">
            {LIFE_REASONS.map((lr) => (
              <button
                key={lr}
                type="button"
                role="radio"
                aria-checked={lifeReason === lr}
                onClick={() => setLifeReason(lr)}
                className={"min-h-10 rounded-full border px-4 text-sm " + (lifeReason === lr ? "border-primary font-semibold text-primary" : "border-border")}
              >
                {lr}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Renda desejada" value={draft.desiredMonthlyIncome} onChange={(v) => set("desiredMonthlyIncome")(v ?? 0)} prefix="R$" />
            <NumberField label="Aporte mensal" value={draft.monthlyContribution} onChange={(v) => set("monthlyContribution")(v ?? 0)} prefix="R$" />
          </div>
          <NumberField label="Aposentar aos" value={draft.retirementAge} onChange={(v) => set("retirementAge")(v ?? 0)} suffix="anos" />
          <DialogFooter>
            <Button disabled={!lifeReason} onClick={() => save("life_event", lifeReason!)}>
              Salvar plano
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;
