import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/forms";
import { startCheckout } from "@/functions/billing";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { FEATURE_LABEL, FEATURE_PLAN, priceCents, type Feature, type PaidPlan, type Period } from "@/lib/billing";
import { formatMoney } from "@/lib/calc/format";
import { BILLING_ENABLED, usePlanAccess } from "@/lib/data/access";
import { reload } from "@/lib/data/cloud";
import { formatDate } from "@/lib/labels";
import { PLANS } from "@/content/pricing";

export const Route = createFileRoute("/_authenticated/assinatura")({
  validateSearch: (s: Record<string, unknown>): { status?: "aprovado" | "pendente" | "recusado" } =>
    s["status"] === "aprovado" || s["status"] === "pendente" || s["status"] === "recusado" ? { status: s["status"] } : {},
  head: () => ({
    meta: [
      { title: "Assinatura — Previdência Intelligence" },
      { name: "description", content: "Seu plano, o que ele inclui e como assinar ou renovar." },
    ],
  }),
  component: Subscription,
});

const STATUS_TEXT = {
  aprovado: "Pagamento aprovado. Seu plano é liberado em instantes.",
  pendente: "Pagamento em processamento. Assim que for confirmado, o plano é liberado sozinho.",
  recusado: "O pagamento não foi concluído. Você pode tentar de novo quando quiser.",
} as const;

function Subscription() {
  const { status } = Route.useSearch();
  const access = usePlanAccess();
  const [period, setPeriod] = useState<Period>("mensal");
  const [busy, setBusy] = useState<PaidPlan | null>(null);
  useEffect(() => track("pricing_view"), []);
  // Na volta do Mercado Pago, o aviso de pagamento pode chegar alguns segundos depois: confere de novo.
  useEffect(() => {
    if (status !== "aprovado" && status !== "pendente") return;
    const timers = [3000, 10000, 25000].map((ms) => setTimeout(() => void reload(), ms));
    return () => timers.forEach(clearTimeout);
  }, [status]);

  async function subscribe(plan: PaidPlan) {
    setBusy(plan);
    track("checkout_start", { plan, period });
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Entre na sua conta para assinar.");
      const r = await startCheckout({ data: { plan, period }, headers: { Authorization: `Bearer ${data.session.access_token}` } });
      window.location.href = r.url;
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  }

  const paid = PLANS.filter((p) => p.slug !== "free") as (typeof PLANS[number] & { slug: PaidPlan })[];
  const features = Object.keys(FEATURE_LABEL) as Feature[];

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-6 lg:max-w-3xl lg:px-8 lg:pb-12 lg:pt-8">
      <h1>Assinatura</h1>
      {status && <p className="mt-3 rounded-xl bg-primary/15 p-3 text-sm text-primary" role="status">{STATUS_TEXT[status]}</p>}

      <section className="mt-6 rounded-2xl bg-card p-5 shadow-card">
        <p className="text-sm text-muted-foreground">Seu plano</p>
        <p className="mt-1 font-display text-3xl font-bold text-primary">{access.plan === "free" ? "Gratuito" : access.plan === "pro" ? "Pro" : "Inteligência"}</p>
        {access.entitlement && access.plan !== "free" && (
          <p className="mt-1 text-sm text-muted-foreground">Válido até {formatDate(access.entitlement.validUntil)}. Renove antes para somar os dias.</p>
        )}
        {!BILLING_ENABLED && <p className="mt-2 text-sm text-muted-foreground">Durante o lançamento, tudo está liberado sem custo.</p>}
      </section>

      {BILLING_ENABLED && (
        <>
          <div className="mt-6 max-w-xs">
            <Segmented
              label="Período"
              value={period}
              onChange={setPeriod}
              options={[
                { value: "mensal", label: "Mensal" },
                { value: "anual", label: "Anual (2 meses grátis)" },
              ]}
            />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {paid.map((p) => (
              <section key={p.slug} className={"rounded-2xl bg-card p-5 shadow-card " + (p.highlight ? "ring-1 ring-primary/60" : "")}>
                <p className="eyebrow">{p.tag}</p>
                <h2 className="mt-1 text-xl">{p.name}</h2>
                <p className="mt-2">
                  <span className="money font-display text-3xl font-bold">{formatMoney(priceCents(p.slug, period))}</span>
                  <span className="text-sm text-muted-foreground">{period === "anual" ? " por 12 meses" : " por mês"}</span>
                </p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {features
                    .filter((f) => FEATURE_PLAN[f] === "inteligencia" || p.slug === "pro")
                    .map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check size={14} className="text-primary" aria-hidden /> {FEATURE_LABEL[f]}
                      </li>
                    ))}
                  {p.features.slice(1).map((f) => (
                    <li key={f} className="flex items-center gap-2 text-muted-foreground">
                      <Check size={14} aria-hidden /> {f}
                    </li>
                  ))}
                </ul>
                <Button className="mt-5 w-full" variant={p.highlight ? "default" : "outline"} disabled={busy !== null} onClick={() => subscribe(p.slug)}>
                  {busy === p.slug ? "Abrindo o pagamento…" : access.plan === p.slug ? "Renovar" : `Assinar ${p.name}`}
                </Button>
              </section>
            ))}
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            Pagamento pelo Mercado Pago, com PIX ou cartão. Sem renovação automática: avisamos antes de vencer. Seus dados continuam seus em qualquer plano,
            sempre com exportação.
          </p>
        </>
      )}
    </main>
  );
}
