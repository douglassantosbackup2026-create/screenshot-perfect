// Gate dos recursos pagos: lê a matriz em src/lib/entitlements e abre o modal de upgrade.
// Com a cobrança desligada (lançamento), tudo fica liberado, com um selo discreto dizendo que o recurso
// é do plano Inteligência: a pessoa usa e já entende o que o plano pago entrega.
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PLANS } from "@/content/pricing";
import {
  canUse,
  FEATURES,
  resolveAccess,
  type Access,
  type FeatureKey,
} from "@/lib/entitlements/matrix";

const BILLING_ENABLED = import.meta.env["VITE_BILLING_ENABLED"] === "true";
/** Só em desenvolvimento: localStorage "pi_tier_preview" = free | inteligencia | pro simula um plano para ver os bloqueios. */
const PREVIEW_KEY = "pi_tier_preview";

const HEADLINES: Record<FeatureKey, string> = {
  what_if: "Teste antes de mudar.",
  goal_seek: "Com quantos anos você pode parar?",
  progress_corridor: "Seu plano está no ritmo?",
  month_projection: "Quanto vai sobrar no fim do mês?",
  anomaly_alerts: "Cobrança estranha? Você fica sabendo.",
  custom_limits: "Um limite para cada hábito.",
  xray: "O que olhar primeiro no seu patrimônio?",
};

export function useAccess(): Access {
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const preview = window.localStorage.getItem(PREVIEW_KEY);
    if (preview === "free" || preview === "inteligencia" || preview === "pro")
      return { tier: preview, launchOpen: false };
  }
  // O direito pago entra aqui quando o Mercado Pago for ligado; até lá, sem direito.
  return resolveAccess({ billingEnabled: BILLING_ENABLED, entitlement: null });
}

/** `allowed` diz se a pessoa pode usar; `ask()` abre o modal quando não pode. Renderize `dialog` na tela. */
export function useFeature(key: FeatureKey) {
  const access = useAccess();
  const [open, setOpen] = useState(false);
  const allowed = canUse(key, access);
  return {
    allowed,
    /** Recurso pago liberado só porque é lançamento: mostre o `LaunchBadge`. */
    preview: access.launchOpen && FEATURES[key].minTier !== "free",
    ask: () => setOpen(true),
    dialog: <UpgradeDialog feature={key} open={open} onOpenChange={setOpen} />,
  };
}

function UpgradeDialog({
  feature,
  open,
  onOpenChange,
}: {
  feature: FeatureKey;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const f = FEATURES[feature];
  const plan = PLANS.find((p) => p.slug === f.minTier)!;
  const headline = HEADLINES[feature];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{headline}</DialogTitle>
          <DialogDescription>{f.upsell}</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl bg-muted p-4 text-sm">
          <p className="text-muted-foreground">Você queria usar:</p>
          <p className="font-semibold">{f.label}</p>
          <p className="mt-1">
            Disponível a partir do {plan.name}
            {plan.period && (
              <span className="money">
                {" "}
                · {plan.price}
                {plan.period}
              </span>
            )}
          </p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Continuar explorando
          </Button>
          <Button asChild>
            <Link to="/planos">Ver assinatura</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Recurso pago bloqueado: uma prévia estática com o benefício, sem renderizar o resultado da pessoa
 * (um conteúdo só borrado continuaria legível no HTML).
 */
export function Blurred({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { allowed, preview, ask, dialog } = useFeature(feature);
  if (allowed)
    return (
      <>
        {preview && <LaunchBadge />}
        {children}
      </>
    );
  return (
    <div className="mt-3 rounded-2xl bg-muted p-4">
      <div className="space-y-2" aria-hidden>
        <div className="h-3 w-2/3 rounded-full bg-foreground/10" />
        <div className="h-3 w-1/2 rounded-full bg-foreground/10" />
        <div className="h-3 w-3/4 rounded-full bg-foreground/10" />
      </div>
      <p className="mt-4 font-semibold">{HEADLINES[feature]}</p>
      <p className="mt-1 text-sm text-muted-foreground">{FEATURES[feature].upsell}</p>
      <Button className="mt-4" onClick={ask}>
        <Lock size={16} strokeWidth={2} aria-hidden /> Ver como liberar
      </Button>
      {dialog}
    </div>
  );
}

/** Selo da prévia de lançamento: o recurso é do plano Inteligência e está grátis por enquanto. */
export function LaunchBadge({ className }: { className?: string }) {
  return (
    <Link to="/planos" className={`inline-flex min-h-11 items-center ${className ?? ""}`}>
      <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">Inteligência · grátis no lançamento</span>
    </Link>
  );
}
