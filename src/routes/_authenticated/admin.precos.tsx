import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { adminGate } from "@/lib/auth/roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/labels";
import { formatMoney } from "@/lib/calc/format";
import { MIN_CHARGE_CENTS, parseCents } from "@/lib/calc/coupon";
import { DEFAULT_PRICES_CENTS, MAX_PRICE_CENTS, PLAN_NAMES, type BillingPeriod, type PaidPlan } from "@/lib/billing/catalog";
import { usePlanPrices } from "@/lib/billing/prices";
import { errMsg } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/admin/precos")({
  beforeLoad: async () => {
    const gate = await adminGate();
    if (gate === "mfa") throw redirect({ to: "/perfil", hash: "seguranca", replace: true });
    if (gate === "no") throw redirect({ to: "/hoje", replace: true });
  },
  head: () => pageHead("Admin de preços", "Preços dos planos para novos assinantes.", "Preços dos planos."),
  component: AdminPrices,
});

const PERIOD_LABEL: Record<BillingPeriod, string> = { mensal: "Mensal", anual: "Anual" };
type Pending = { plan: PaidPlan; period: BillingPeriod; from: number; to: number };

function AdminPrices() {
  const { prices, rows, reload } = usePlanPrices();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_plan_price", { p_plan: pending.plan, p_period: pending.period, p_cents: pending.to });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success("Preço salvo. Vale para quem assinar a partir de agora.");
    setPending(null);
    reload();
  }

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-28 pt-8">
      <h1>Preços</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Acesso só para administradores. O preço novo vale para quem assinar depois; quem já assina continua pagando o valor do dia em
        que assinou. Cupons são aplicados sobre o preço de hoje.
      </p>
      {!rows && <div className="mt-6 h-36 animate-pulse rounded-2xl bg-card" aria-busy="true" />}
      {rows && (
        <ul className="mt-6 space-y-4">
          {(Object.keys(DEFAULT_PRICES_CENTS) as PaidPlan[]).map((plan) => (
            <li key={plan} className="rounded-2xl bg-card p-4 shadow-card">
              <p className="font-semibold">{PLAN_NAMES[plan]}</p>
              {plan === "pro" && <p className="text-xs text-muted-foreground">Ainda em lista de espera: o preço só aparece como anúncio.</p>}
              <div className="mt-3 space-y-3">
                {(Object.keys(DEFAULT_PRICES_CENTS[plan]) as BillingPeriod[]).map((period) => (
                  <PriceRow
                    key={period}
                    label={PERIOD_LABEL[period]}
                    cents={prices[plan][period]!}
                    updatedAt={rows.find((r) => r.plan === plan && r.period === period)?.updated_at ?? null}
                    onSave={(to) => setPending({ plan, period, from: prices[plan][period]!, to })}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mudar o preço?</DialogTitle>
            <DialogDescription>
              {pending &&
                `${PLAN_NAMES[pending.plan]} ${PERIOD_LABEL[pending.period].toLowerCase()}: novos assinantes pagarão ${formatMoney(pending.to)} (hoje ${formatMoney(pending.from)}). Quem já assina continua pagando o valor atual.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={confirm}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function PriceRow({ label, cents, updatedAt, onSave }: { label: string; cents: number; updatedAt: string | null; onSave: (cents: number) => void }) {
  const [text, setText] = useState(String(cents / 100).replace(".", ","));
  useEffect(() => setText((cents / 100).toFixed(2).replace(".", ",")), [cents]);
  const next = parseCents(text);
  const valid = next !== null && next >= MIN_CHARGE_CENTS && next <= MAX_PRICE_CENTS;
  const id = `price-${label}`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold">
        {label} (R$)
      </label>
      <div className="mt-1.5 flex gap-2">
        <Input id={id} className="h-11" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} />
        <Button
          variant="outline"
          disabled={!valid || next === cents}
          onClick={() => (valid ? onSave(next) : toast.error("Informe um valor a partir de R$ 1,00."))}
        >
          Salvar
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Hoje: {formatMoney(cents)}
        {updatedAt ? ` · alterado em ${formatDate(updatedAt)}` : ""}
      </p>
    </div>
  );
}
