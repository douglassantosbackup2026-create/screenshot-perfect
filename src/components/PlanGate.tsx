// Mostra a função paga ou, sem o plano, um convite para assinar. Com dados já registrados, sempre mostra.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURE_LABEL, MONTHLY_CENTS, type Feature } from "@/lib/billing";
import { formatMoney } from "@/lib/calc/format";
import { usePlanAccess } from "@/lib/data/access";

export function PlanGate({ feature, hasData = false, children }: { feature: Feature; hasData?: boolean; children: ReactNode }) {
  const access = usePlanAccess();
  if (access.can(feature, hasData)) return <>{children}</>;
  return <Upsell feature={feature} />;
}

export function Upsell({ feature }: { feature: Feature }) {
  return (
    <section className="rounded-2xl bg-card p-6 text-center shadow-card ring-1 ring-primary/40" aria-label="Recurso do plano Inteligência">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary" aria-hidden>
        <Lock size={18} />
      </span>
      <h2 className="mt-3 text-lg">{FEATURE_LABEL[feature]}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Faz parte do plano Inteligência, por {formatMoney(MONTHLY_CENTS.inteligencia)} por mês. PIX ou cartão, sem fidelidade.
      </p>
      <Button asChild className="mt-4">
        <Link to="/assinatura">Ver planos</Link>
      </Button>
    </section>
  );
}
