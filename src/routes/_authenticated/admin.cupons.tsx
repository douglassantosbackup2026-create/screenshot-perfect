import { useCallback, useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { pageHead } from "@/lib/seo";
import { adminGate } from "@/lib/auth/roles";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/labels";
import { formatMoney } from "@/lib/calc/format";
import { describeCoupon, discountedCents, DURATION_LABEL, parseCents, type CouponDuration, type CouponKind } from "@/lib/calc/coupon";
import { parseRate } from "@/lib/calc/commission";
import { DEFAULT_PRICES_CENTS, type BillingPeriod } from "@/lib/billing/catalog";
import { usePlanPrices } from "@/lib/billing/prices";
import { errMsg } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/admin/cupons")({
  beforeLoad: async () => {
    const gate = await adminGate();
    if (gate === "mfa") throw redirect({ to: "/perfil", hash: "seguranca", replace: true });
    if (gate === "no") throw redirect({ to: "/hoje", replace: true });
  },
  head: () => pageHead("Admin de cupons", "Cupons de desconto da assinatura, com afiliado opcional.", "Cupons de desconto da assinatura."),
  component: AdminCoupons,
});

type Coupon = {
  id: string;
  code: string;
  kind: CouponKind;
  value: number;
  duration: CouponDuration;
  cycles: number | null;
  periods: BillingPeriod[];
  max_uses: number | null;
  expires_at: string | null;
  active: boolean;
  affiliate_id: string | null;
  affiliate_name: string | null;
  uses: number;
  created_at: string;
};
type AffiliateOption = { id: string; name: string; code: string | null; status: string };

const NONE = "nenhum";
const PERIODS = Object.keys(DEFAULT_PRICES_CENTS.inteligencia) as BillingPeriod[];

function AdminCoupons() {
  const [rows, setRows] = useState<Coupon[] | null>(null);
  const [affiliates, setAffiliates] = useState<AffiliateOption[]>([]);
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);

  const load = useCallback(async () => {
    const [c, a] = await Promise.all([supabase.rpc("admin_list_coupons"), supabase.rpc("admin_list_affiliates", { p_status: "aprovado" })]);
    if (c.error) return void toast.error(errMsg(c.error));
    setRows(c.data as unknown as Coupon[]);
    if (!a.error) setAffiliates(a.data as unknown as AffiliateOption[]);
  }, []);
  useEffect(() => void load(), [load]);

  async function toggle(c: Coupon, active: boolean) {
    const { error } = await supabase.rpc("admin_set_coupon_active", { p_id: c.id, p_active: active });
    if (error) return void toast.error(errMsg(error));
    toast.success(active ? "Cupom ativado." : "Cupom desativado.");
    void load();
  }

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-28 pt-8">
      <div className="flex items-center justify-between gap-3">
        <h1>Cupons</h1>
        <Button onClick={() => setEditing("new")}>Novo cupom</Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Acesso só para administradores. O desconto vale na assinatura do Mercado Pago; terminado o prazo, ela volta ao preço cheio. Cupom de
        afiliado liga quem usa a ele, e a comissão sai sobre o valor pago.
      </p>
      {!rows && <div className="mt-6 h-36 animate-pulse rounded-2xl bg-card" aria-busy="true" />}
      {rows && !rows.length && <p className="mt-6 text-sm text-muted-foreground">Nenhum cupom ainda.</p>}
      <ul className="mt-6 space-y-4">
        {rows?.map((c) => {
          const expired = !!c.expires_at && new Date(c.expires_at) <= new Date();
          return (
            <li key={c.id} className={"rounded-2xl bg-card p-4 shadow-card " + (c.active && !expired ? "" : "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="money text-xl text-primary">{c.code}</p>
                  <p className="text-sm">{describeCoupon(c)}</p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <Switch checked={c.active} onCheckedChange={(v) => toggle(c, v)} aria-label={`Cupom ${c.code} ativo`} />
                  {c.active ? "Ativo" : "Inativo"}
                </label>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Planos</dt>
                <dd>{c.periods.join(" e ")}</dd>
                <dt className="text-muted-foreground">Usos</dt>
                <dd className="money">
                  {c.uses}
                  {c.max_uses !== null ? ` / ${c.max_uses}` : ""}
                </dd>
                <dt className="text-muted-foreground">Validade</dt>
                <dd>{c.expires_at ? `${expired ? "venceu em" : "até"} ${formatDate(c.expires_at)}` : "Sem prazo"}</dd>
                <dt className="text-muted-foreground">Afiliado</dt>
                <dd>{c.affiliate_name ?? "Nenhum"}</dd>
              </dl>
              <Button size="sm" variant="outline" className="mt-4" onClick={() => setEditing(c)}>
                Editar
              </Button>
            </li>
          );
        })}
      </ul>
      {editing && (
        <CouponDialog
          coupon={editing === "new" ? null : editing}
          affiliates={affiliates}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      )}
    </main>
  );
}

function CouponDialog({
  coupon,
  affiliates,
  onClose,
  onSaved,
}: {
  coupon: Coupon | null;
  affiliates: AffiliateOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(coupon?.code ?? "");
  const [kind, setKind] = useState<CouponKind>(coupon?.kind ?? "percent");
  const [value, setValue] = useState(coupon ? String(coupon.value / 100).replace(".", ",") : "20");
  const [duration, setDuration] = useState<CouponDuration>(coupon?.duration ?? "primeira");
  const [cycles, setCycles] = useState(String(coupon?.cycles ?? 3));
  const [periods, setPeriods] = useState<BillingPeriod[]>(coupon?.periods ?? PERIODS);
  const [maxUses, setMaxUses] = useState(coupon?.max_uses ? String(coupon.max_uses) : "");
  const [expires, setExpires] = useState(coupon?.expires_at ? coupon.expires_at.slice(0, 10) : "");
  const [affiliateId, setAffiliateId] = useState(coupon?.affiliate_id ?? NONE);
  const [busy, setBusy] = useState(false);
  const { prices } = usePlanPrices();

  // % em basis points; R$ em centavos.
  const parsed = kind === "percent" ? parseRate(value) : parseCents(value);
  const n = Number(cycles);
  const cyclesOk = duration !== "meses" || (Number.isInteger(n) && n >= 1 && n <= 120);
  const codeOk = /^[A-Z0-9]{3,20}$/.test(code);
  const terms = parsed ? { kind, value: parsed, duration, cycles: duration === "meses" ? n : null } : null;
  // Afiliado que não está mais aprovado continua aparecendo para não sumir da edição.
  const options = coupon?.affiliate_id && !affiliates.some((a) => a.id === coupon.affiliate_id)
    ? [...affiliates, { id: coupon.affiliate_id, name: coupon.affiliate_name ?? "Afiliado", code: null, status: "" }]
    : affiliates;

  async function save() {
    if (!codeOk || !terms || !cyclesOk || !periods.length)
      return void toast.error("Confira o código (3 a 20 letras ou números), o desconto, as cobranças e os planos.");
    setBusy(true);
    const payload = {
      code,
      kind,
      value: terms.value,
      duration,
      cycles: terms.cycles,
      periods,
      max_uses: maxUses ? Number(maxUses) : null,
      expires_at: expires ? new Date(`${expires}T23:59:59-03:00`).toISOString() : null,
      affiliate_id: affiliateId === NONE ? null : affiliateId,
    };
    const { error } = await supabase.rpc("admin_save_coupon", { p_id: (coupon?.id ?? null) as unknown as string, p_coupon: payload as unknown as Json });
    setBusy(false);
    if (error) return void toast.error(errMsg(error));
    toast.success(coupon ? "Cupom salvo." : "Cupom criado.");
    onSaved();
    onClose();
  }

  const field = "space-y-1.5";
  const label = "text-sm font-semibold";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{coupon ? `Editar ${coupon.code}` : "Novo cupom"}</DialogTitle>
          <DialogDescription>Mudanças valem para quem assinar depois; assinaturas já abertas seguem como estão.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className={field}>
            <label htmlFor="c-code" className={label}>
              Código
            </label>
            <Input id="c-code" className="h-11 uppercase" maxLength={20} value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={field}>
              <span className={label}>Desconto em</span>
              <Select value={kind} onValueChange={(v) => setKind(v as CouponKind)}>
                <SelectTrigger className="h-11 rounded-xl bg-muted" aria-label="Tipo de desconto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Porcentagem (%)</SelectItem>
                  <SelectItem value="fixed">Valor (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={field}>
              <label htmlFor="c-value" className={label}>
                {kind === "percent" ? "Desconto (%)" : "Desconto (R$)"}
              </label>
              <Input id="c-value" className="h-11" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={field}>
              <span className={label}>Vale em</span>
              <Select value={duration} onValueChange={(v) => setDuration(v as CouponDuration)}>
                <SelectTrigger className="h-11 rounded-xl bg-muted" aria-label="Duração do desconto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DURATION_LABEL) as CouponDuration[]).map((d) => (
                    <SelectItem key={d} value={d}>
                      {DURATION_LABEL[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {duration === "meses" && (
              <div className={field}>
                <label htmlFor="c-cycles" className={label}>
                  Quantas cobranças
                </label>
                <Input id="c-cycles" className="h-11" inputMode="numeric" value={cycles} onChange={(e) => setCycles(e.target.value.replace(/\D/g, ""))} />
              </div>
            )}
          </div>
          <div className={field}>
            <span className={label}>Planos</span>
            <div className="flex gap-4">
              {PERIODS.map((p) => (
                <label key={p} className="flex min-h-11 items-center gap-2 text-sm">
                  <Checkbox
                    checked={periods.includes(p)}
                    onCheckedChange={(v) => setPeriods((cur) => (v === true ? [...new Set([...cur, p])] : cur.filter((x) => x !== p)))}
                  />
                  {p === "mensal" ? "Mensal" : "Anual"}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className={field}>
              <label htmlFor="c-max" className={label}>
                Limite de usos
              </label>
              <Input id="c-max" className="h-11" inputMode="numeric" placeholder="Sem limite" value={maxUses} onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className={field}>
              <label htmlFor="c-exp" className={label}>
                Válido até
              </label>
              <Input id="c-exp" type="date" className="h-11" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
          </div>
          <div className={field}>
            <span className={label}>Afiliado</span>
            <Select value={affiliateId} onValueChange={setAffiliateId}>
              <SelectTrigger className="h-11 rounded-xl bg-muted" aria-label="Afiliado do cupom">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Nenhum</SelectItem>
                {options.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.code ? ` (${a.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {terms && cyclesOk && (
            <div className="rounded-xl bg-muted p-3 text-sm">
              <p className="font-semibold">{describeCoupon(terms)}</p>
              {periods.map((p) => {
                const full = prices.inteligencia[p]!;
                return (
                  <p key={p} className="mt-1">
                    {p === "mensal" ? "Mensal" : "Anual"}: <s className="text-muted-foreground">{formatMoney(full)}</s> →{" "}
                    <span className="money text-primary">{formatMoney(discountedCents(full, terms))}</span>
                  </p>
                );
              })}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button disabled={busy} onClick={save}>
            {coupon ? "Salvar" : "Criar cupom"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
