import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { createSubscription } from "@/lib/billing/subscription.functions";
import { PRICES_CENTS, type BillingPeriod } from "@/lib/billing/catalog";

const formatCents = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Assinar o Inteligência, mensal ou anual: abre o Mercado Pago, que volta para /pagamento. */
export function SubscribeButtons() {
  const subscribe = useServerFn(createSubscription);
  const [busy, setBusy] = useState<BillingPeriod | null>(null);
  async function start(period: BillingPeriod) {
    setBusy(period);
    try {
      const r = await subscribe({ data: { plan: "inteligencia", period } });
      if (r.url) window.location.href = r.url;
      else toast.error(r.error ?? "Não foi possível abrir a assinatura.");
    } catch {
      toast.error("Não foi possível abrir a assinatura. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }
  const periods = Object.keys(PRICES_CENTS.inteligencia) as BillingPeriod[];
  return (
    <div className="mt-5 space-y-2">
      {periods.map((p) => (
        <Button key={p} className="w-full" variant={p === "mensal" ? "default" : "outline"} disabled={busy !== null} onClick={() => start(p)}>
          {busy === p ? "Abrindo…" : `Assinar ${p} · ${formatCents(PRICES_CENTS.inteligencia[p]!)}`}
        </Button>
      ))}
      <p className="text-xs text-muted-foreground">Cartão de crédito, pelo Mercado Pago. Cancele quando quiser.</p>
    </div>
  );
}
