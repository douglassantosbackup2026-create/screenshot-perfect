import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/labels";
import { formatMoney } from "@/lib/calc/format";
import { describeRule, type CommissionMode } from "@/lib/calc/commission";
import { describeCoupon, type CouponTerms } from "@/lib/calc/coupon";
import { errMsg } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/parceiro")({
  head: () => pageHead("Programa de parceiros", "Seu link de indicação e suas comissões.", "Seu link e suas comissões."),
  component: AffiliatePanel,
});

type Commission = { id: string; payment_cents: number; commission_cents: number; status: string; created_at: string; paid_at: string | null };
type Mine = {
  status: "pendente" | "aprovado" | "recusado" | "suspenso";
  name: string;
  code: string | null;
  commission_mode: CommissionMode;
  commission_bp: number;
  commission_months: number | null;
  review_note: string;
  referrals: number;
  pending_cents: number;
  paid_cents: number;
  commissions: Commission[];
  coupons?: (CouponTerms & { code: string; expires_at: string | null })[];
};

const STATUS_LABEL: Record<string, string> = { pendente: "A receber", paga: "Paga", cancelada: "Cancelada" };

function AffiliatePanel() {
  const [mine, setMine] = useState<Mine | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void supabase.rpc("my_affiliate").then(({ data, error }) => {
      if (!live) return;
      if (error) {
        toast.error(errMsg(error));
        setMine(null);
      } else setMine(data as unknown as Mine | null);
    });
    return () => {
      live = false;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-28 pt-8">
      <h1>Programa de parceiros</h1>
      {mine === undefined && <div className="mt-6 h-36 animate-pulse rounded-2xl bg-card" aria-busy="true" />}
      {mine === null && (
        <section className="mt-6 rounded-2xl bg-card p-6 shadow-card">
          <p>Não encontramos uma inscrição de parceiro no e-mail desta conta.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            A inscrição precisa ter o mesmo e-mail da conta, e o e-mail precisa estar confirmado.
          </p>
          <Button asChild className="mt-4">
            <Link to="/parceiros">Quero ser parceiro</Link>
          </Button>
        </section>
      )}
      {mine && mine.status !== "aprovado" && (
        <section className="mt-6 rounded-2xl bg-card p-6 shadow-card" role="status">
          {mine.status === "pendente" && <p>Recebemos sua inscrição. Ela está em análise e você será avisado.</p>}
          {mine.status === "recusado" && (
            <>
              <p>Sua inscrição não foi aprovada desta vez.</p>
              {mine.review_note && <p className="mt-2 text-sm text-muted-foreground">{mine.review_note}</p>}
            </>
          )}
          {mine.status === "suspenso" && (
            <p>Sua participação está suspensa. Indicações novas e comissões estão paradas; fale com a equipe.</p>
          )}
        </section>
      )}
      {mine?.status === "aprovado" && mine.code && <Approved mine={mine} code={mine.code} />}
    </main>
  );
}

function Approved({ mine, code }: { mine: Mine; code: string }) {
  const link = `${typeof window === "undefined" ? "" : window.location.origin}/?ref=${code}`;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie.");
    }
  }

  return (
    <>
      <section className="mt-6 rounded-2xl bg-card p-5 shadow-card">
        <p className="eyebrow">Seu código</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="money text-3xl text-primary">{code}</span>
          <Button size="icon" variant="ghost" aria-label="Copiar código" onClick={() => copy(code)}>
            <Copy size={16} />
          </Button>
        </div>
        <p className="eyebrow mt-4">Seu link</p>
        <div className="mt-1 flex items-center gap-2 rounded-xl bg-muted p-2">
          <code className="min-w-0 flex-1 truncate text-xs">{link}</code>
          <Button size="icon" variant="ghost" aria-label="Copiar link" onClick={() => copy(link)}>
            <Copy size={16} />
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Comissão: {describeRule({ mode: mine.commission_mode, bp: mine.commission_bp, months: mine.commission_months })}. O código não dá desconto; ele só
          liga a pessoa a você.
        </p>
      </section>

      {!!mine.coupons?.length && (
        <section className="mt-4 rounded-2xl bg-card p-5 shadow-card">
          <p className="eyebrow">Seus cupons de desconto</p>
          <p className="mt-1 text-sm text-muted-foreground">Quem assina com um destes cupons ganha o desconto e fica ligado a você.</p>
          <ul className="mt-3 divide-y divide-border">
            {mine.coupons.map((k) => {
              const withCoupon = `${link}&cupom=${k.code}`;
              return (
                <li key={k.code} className="flex items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="money block text-primary">{k.code}</span>
                    <span className="block text-sm text-muted-foreground">
                      {describeCoupon(k)}
                      {k.expires_at ? ` · até ${formatDate(k.expires_at)}` : ""}
                    </span>
                  </span>
                  <Button size="icon" variant="ghost" aria-label={`Copiar link com o cupom ${k.code}`} onClick={() => copy(withCoupon)}>
                    <Copy size={16} />
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[
          ["Indicados", String(mine.referrals)],
          ["A receber", formatMoney(mine.pending_cents)],
          ["Recebido", formatMoney(mine.paid_cents)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-card p-4 shadow-card">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="money mt-1 text-lg">{v}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 text-lg">Últimas comissões</h2>
      {mine.commissions.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Ainda nenhuma. Elas aparecem quando um indicado tem um pagamento aprovado.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border text-sm">
          {mine.commissions.map((c) => (
            <li key={c.id} className="flex justify-between gap-2 py-2">
              <span>
                {formatDate(c.created_at)} · pagamento de {formatMoney(c.payment_cents)}
              </span>
              <span className="money">
                {formatMoney(c.commission_cents)} · {STATUS_LABEL[c.status] ?? c.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
