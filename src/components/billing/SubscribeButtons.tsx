import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSubscription, previewCoupon } from "@/lib/billing/subscription.functions";
import type { BillingPeriod, PlanPrices } from "@/lib/billing/catalog";
import { track } from "@/lib/analytics/analytics";
import { clearCoupon, currentCoupon } from "@/lib/affiliates/ref";

const formatCents = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Applied = { code: string; description: string; prices: Partial<Record<BillingPeriod, { fullCents: number; amountCents: number }>> };

/** Assinar o Inteligência, mensal ou anual: abre o Mercado Pago, que volta para /pagamento. Aceita cupom. */
export function SubscribeButtons({ prices }: { prices: PlanPrices }) {
  const subscribe = useServerFn(createSubscription);
  const preview = useServerFn(previewCoupon);
  const [busy, setBusy] = useState<BillingPeriod | null>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [applied, setApplied] = useState<Applied | null>(null);

  // Veio de um link com ?cupom=: já aplica.
  useEffect(() => {
    const saved = currentCoupon();
    if (saved) {
      setCode(saved);
      setCouponOpen(true);
      void apply(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function apply(value = code) {
    if (!value.trim()) return;
    setChecking(true);
    try {
      const r = await preview({ data: { code: value } });
      if (r.prices) {
        setApplied({ code: r.code!, description: r.description!, prices: r.prices });
        toast.success("Cupom aplicado.");
      } else {
        setApplied(null);
        clearCoupon();
        toast.error(r.error ?? "Cupom inválido.");
      }
    } catch {
      toast.error("Não foi possível conferir o cupom. Tente de novo.");
    } finally {
      setChecking(false);
    }
  }

  async function start(period: BillingPeriod) {
    setBusy(period);
    try {
      const coupon = applied?.prices[period] ? applied.code : undefined;
      const r = await subscribe({ data: { plan: "inteligencia", period, coupon } });
      if (r.url) {
        track("checkout_started", { period, coupon: !!coupon });
        window.location.href = r.url;
      }
      else toast.error(r.error ?? "Não foi possível abrir a assinatura.");
    } catch {
      toast.error("Não foi possível abrir a assinatura. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }
  const periods = Object.keys(prices.inteligencia) as BillingPeriod[];
  return (
    <div className="mt-5 space-y-2">
      {periods.map((p) => {
        const off = applied?.prices[p];
        return (
          <Button key={p} className="w-full" variant={p === "mensal" ? "default" : "outline"} disabled={busy !== null || checking} onClick={() => start(p)}>
            {busy === p ? (
              "Abrindo…"
            ) : off ? (
              <>
                Assinar {p} · <s className="opacity-60">{formatCents(off.fullCents)}</s> {formatCents(off.amountCents)}
              </>
            ) : (
              `Assinar ${p} · ${formatCents(prices.inteligencia[p]!)}`
            )}
          </Button>
        );
      })}
      {applied ? (
        <p className="text-sm" role="status">
          Cupom <span className="font-semibold text-primary">{applied.code}</span>: {applied.description}.{" "}
          <button
            type="button"
            className="min-h-11 font-semibold text-primary"
            onClick={() => {
              setApplied(null);
              setCode("");
              clearCoupon();
            }}
          >
            Remover
          </button>
        </p>
      ) : couponOpen ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void apply();
          }}
        >
          <Input
            aria-label="Cupom de desconto"
            placeholder="CUPOM"
            className="h-11 uppercase"
            maxLength={20}
            autoCapitalize="characters"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          />
          <Button type="submit" variant="outline" disabled={checking || !code}>
            {checking ? "Conferindo…" : "Aplicar"}
          </Button>
        </form>
      ) : (
        <button type="button" className="min-h-11 text-sm font-semibold text-primary" onClick={() => setCouponOpen(true)}>
          Tenho um cupom
        </button>
      )}
      <p className="text-xs text-muted-foreground">Cartão de crédito, pelo Mercado Pago. Cancele quando quiser.</p>
    </div>
  );
}
