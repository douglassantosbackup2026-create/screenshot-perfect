import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { APP_NAME, pageHead } from "@/lib/seo";
import { Waitlist } from "@/components/sales/sections";
import { SubscribeButtons } from "@/components/billing/SubscribeButtons";
import { useAccess } from "@/lib/billing/access";
import { cancelSubscription } from "@/lib/billing/subscription.functions";
import { PLANS, PRICING_NOTE } from "@/content/pricing";
import { formatDate } from "@/lib/labels";
import { useDemo } from "@/lib/data/demo-store";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => pageHead("Assinatura", `Assine o ${APP_NAME}: orçamento, patrimônio e aposentadoria num app só.`),
  component: Plans,
});

type Current = { status: string; period: string; validUntil: string | null };
type Loaded = { kind: "loading" } | { kind: "error" } | { kind: "ok"; current: Current | null };

const STATUS: Record<string, string> = {
  authorized: "Ativa, com renovação automática",
  pending: "Aguardando a confirmação do cartão",
  paused: "Pausada",
  cancelled: "Cancelada",
};

/** Assinatura salva no banco (gravada pelo webhook) e até quando o acesso vale. */
function useCurrentSubscription(enabled: boolean) {
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let stale = false;
    setLoaded({ kind: "loading" });
    void (async () => {
      try {
        const [sub, ent] = await Promise.all([
          supabase.from("subscriptions").select("status, period").maybeSingle(),
          supabase.from("entitlements").select("valid_until").maybeSingle(),
        ]);
        if (stale) return;
        if (sub.error || ent.error) return setLoaded({ kind: "error" });
        setLoaded({
          kind: "ok",
          current: sub.data ? { status: sub.data.status, period: sub.data.period, validUntil: ent.data?.valid_until ?? null } : null,
        });
      } catch {
        if (!stale) setLoaded({ kind: "error" });
      }
    })();
    return () => {
      stale = true;
    };
  }, [enabled, version]);
  return { loaded, reload: () => setVersion((v) => v + 1) };
}

function Plans() {
  const access = useAccess();
  const s = useDemo();
  const plan = PLANS.find((p) => p.slug === "inteligencia")!;
  const pro = PLANS.find((p) => p.slug === "pro")!;
  const subscribed = access.active && !access.billingOff;
  const { loaded, reload } = useCurrentSubscription(subscribed);
  const returning = !access.active && !!s.profile.onboardingCompletedAt;

  return (
    <main className="mx-auto w-full max-w-[480px] px-5 pb-32 pt-8 lg:max-w-3xl lg:px-8 lg:pb-12">
      <h1>{access.active ? "Assinatura" : `Assine para usar o ${APP_NAME}`}</h1>
      <p className="mt-1 text-muted-foreground">
        {returning
          ? "Seus dados estão guardados. Assine para voltar a usar."
          : "Uma assinatura com tudo: orçamento, patrimônio e aposentadoria."}
      </p>

      {access.billingOff && (
        <p className="mt-6 rounded-2xl bg-primary/15 p-4 text-sm">
          As assinaturas ainda não começaram. Por enquanto, o app está liberado; avisamos antes de começar a cobrar.
        </p>
      )}

      {subscribed && loaded.kind === "loading" && (
        <div className="mt-6 h-32 animate-pulse rounded-3xl bg-card" aria-busy="true" aria-label="Carregando sua assinatura" />
      )}
      {subscribed && loaded.kind === "error" && (
        <section className="mt-6 rounded-3xl bg-card p-6 text-sm shadow-card" role="alert">
          <p>Não foi possível carregar os detalhes da sua assinatura. Seu acesso continua normal.</p>
          <Button variant="outline" className="mt-4" onClick={reload}>
            Tentar de novo
          </Button>
        </section>
      )}
      {subscribed && loaded.kind === "ok" && loaded.current && <CurrentCard current={loaded.current} onCancelled={reload} />}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl bg-card p-6 shadow-card ring-2 ring-primary" aria-label={`Plano ${plan.name}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-xl font-semibold">{plan.name}</p>
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">{plan.tag}</span>
          </div>
          <p className="money mt-1 text-2xl font-semibold">
            {plan.price}
            <span className="text-sm font-normal text-muted-foreground">{plan.period}</span>
          </p>
          {plan.annualNote && <p className="text-sm text-muted-foreground">{plan.annualNote}</p>}
          <ul className="mt-4 space-y-2 text-sm">
            {plan.features.map((f) => (
              <li key={f} className="flex gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          {!access.active && <SubscribeButtons />}
        </section>

        <section className="rounded-3xl bg-card p-6 shadow-card" aria-label={`Plano ${pro.name}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-xl font-semibold">{pro.name}</p>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{pro.tag}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{pro.summary}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {pro.features.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
          {pro.waitlistSource && <Waitlist source={pro.waitlistSource} planName={pro.name} />}
        </section>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">{PRICING_NOTE}</p>
    </main>
  );
}

function CurrentCard({ current, onCancelled }: { current: Current; onCancelled: () => void }) {
  const cancel = useServerFn(cancelSubscription);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelled = current.status === "cancelled";
  const until = current.validUntil ? formatDate(current.validUntil) : null;

  async function confirm() {
    setBusy(true);
    try {
      const r = await cancel();
      if (r.error) return void toast.error(r.error);
      toast("Assinatura cancelada. Nenhuma nova cobrança será feita.");
      setConfirming(false);
      onCancelled();
    } catch {
      toast.error("Não foi possível cancelar agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl bg-card p-6 shadow-card" aria-label="Sua assinatura">
      <p className="text-sm text-muted-foreground">Sua assinatura</p>
      <p className="mt-1 font-semibold">Inteligência {current.period}</p>
      <p className="mt-1 text-sm">{STATUS[current.status] ?? current.status}</p>
      {until && (
        <p className="mt-1 text-sm text-muted-foreground">
          {cancelled ? `Acesso até ${until}.` : `Pago até ${until}; a próxima cobrança é automática.`}
        </p>
      )}
      {!cancelled &&
        (confirming ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm">Cancelar para as próximas cobranças? Você continua usando até o fim do período pago.</p>
            <Button variant="outline" className="w-full" disabled={busy} onClick={confirm}>
              {busy ? "Cancelando…" : "Confirmar cancelamento"}
            </Button>
            <Button variant="ghost" className="w-full" disabled={busy} onClick={() => setConfirming(false)}>
              Manter assinatura
            </Button>
          </div>
        ) : (
          <Button variant="ghost" className="mt-4 w-full" onClick={() => setConfirming(true)}>
            Cancelar assinatura
          </Button>
        ))}
    </section>
  );
}
