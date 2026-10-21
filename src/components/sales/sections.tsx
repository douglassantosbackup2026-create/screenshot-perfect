import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { LESSONS } from "@/content/program";
import { UNITS } from "@/content/journey";
import { PLANS, PRICING_NOTE, type PlanTier } from "@/content/pricing";
import { useServerFn } from "@tanstack/react-start";
import { createCheckout } from "@/lib/billing/checkout.functions";
import { PRICES_CENTS, type BillingPeriod, type PaidPlan } from "@/lib/billing/catalog";

export function Problem() {
  const items = [
    ["O INSS sozinho costuma não bastar.", "O teto é limitado e as regras mudam. Contar só com ele é arriscado."],
    ["A inflação come o dinheiro parado.", "Com 4% ao ano, os preços dobram em cerca de 18 anos."],
    ["O difícil é manter.", "Começar é fácil. O que faz diferença é guardar todo mês, por anos."],
  ];
  return (
    <section className="mt-16">
      <h2>Por que pensar nisso agora</h2>
      <div className="mt-5 space-y-4">
        {items.map(([t, d]) => (
          <div key={t} className="rounded-2xl bg-card shadow-card p-4">
            <p className="font-semibold">{t}</p>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    "Jornada: lições de 2 a 5 minutos em 4 unidades, com missão do dia, XP e sequência sem punição por pausas.",
    "Na Unidade 2, seu plano de aposentadoria fica pronto.",
    "Evolução: todo mês, você registra aporte e patrimônio e vê seu progresso rumo à independência.",
  ];
  return (
    <section className="mt-16">
      <h2>Como funciona</h2>
      <ol className="mt-5 space-y-4">
        {steps.map((t, i) => (
          <li key={t} className="flex gap-4">
            <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
              {i + 1}
            </span>
            <span className="pt-1.5">{t}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ProductPreview() {
  return (
    <section className="mt-16" aria-label="Prévia do app">
      <h2>O que você vai usar</h2>
      <p className="mt-2 text-sm text-muted-foreground">Telas de exemplo.</p>
      <div className="mt-5 space-y-3">
        <div className="rounded-2xl bg-card shadow-card p-4">
          <p className="text-xs text-muted-foreground">Jornada · Unidade 1 · Lição 2 de 5</p>
          <p className="mt-1 font-semibold">{LESSONS[1]?.title}</p>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div className="h-2 w-[14%] rounded-full bg-accent" />
          </div>
        </div>
        <div className="rounded-2xl bg-card shadow-card p-4">
          <p className="text-xs text-muted-foreground">Plano</p>
          <p className="mt-1 font-semibold">Três cenários, premissas sempre visíveis</p>
          <div className="mt-3 flex items-end gap-2" aria-hidden>
            {[30, 45, 60].map((h) => (
              <div key={h} className="w-8 rounded-t bg-primary/70" style={{ height: h }} />
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-card shadow-card p-4">
          <p className="text-xs text-muted-foreground">Evolução</p>
          <p className="mt-1 font-semibold">Seu progresso comparado só com você mesmo</p>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div className="h-2 w-[38%] rounded-full bg-accent" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Metas, desafios pessoais e linha do tempo do patrimônio.</p>
        </div>
        <div className="rounded-2xl bg-card shadow-card p-4">
          <p className="text-xs text-muted-foreground">Diário</p>
          <p className="mt-1 font-semibold">Registre o aporte do mês em segundos</p>
          <div className="mt-3 flex gap-1.5" aria-hidden>
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className={`h-3 w-3 rounded-full ${i < 6 ? "bg-accent" : "bg-muted"}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Curriculum() {
  return (
    <section className="mt-16">
      <h2>As 4 unidades</h2>
      <Accordion type="single" collapsible className="mt-4">
        {UNITS.map((u) => (
          <AccordionItem key={u.n} value={`u${u.n}`}>
            <AccordionTrigger>
              Unidade {u.n} · {u.title}
            </AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-2">
                {u.lessons.map((d, i) => (
                  <li key={d} className="flex gap-3 text-sm">
                    <span className="w-16 shrink-0 text-muted-foreground">Lição {i + 1}</span>
                    <span>{LESSONS.find((l) => l.day === d)?.title}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-sm text-primary">Ao concluir: {u.result}</p>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export function WhatWeDont() {
  return (
    <section className="mt-16 border-l-2 border-primary pl-4">
      <h2 className="text-lg">O que não fazemos</h2>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        <li>Não vendemos investimentos.</li>
        <li>Não pedimos sua senha do banco.</li>
        <li>Não movimentamos seu dinheiro.</li>
      </ul>
    </section>
  );
}

export function Pricing({ onStart }: { onStart: () => void }) {
  return (
    <section className="mt-16" aria-label="Planos">
      <h2>Planos</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        O aprendizado é gratuito. Os planos pagos vendem clareza, planejamento e acompanhamento, nunca produtos financeiros.
      </p>
      <div className="mt-5 space-y-4">
        {PLANS.map((plan) => (
          <PlanCard key={plan.slug} plan={plan} onStart={onStart} />
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{PRICING_NOTE}</p>
    </section>
  );
}

function PlanCard({ plan, onStart }: { plan: PlanTier; onStart: () => void }) {
  return (
    <div className={`rounded-3xl bg-card p-6 shadow-card ${plan.highlight ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-xl font-semibold">{plan.name}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${plan.highlight ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {plan.tag}
        </span>
      </div>
      <p className="money mt-1 text-2xl font-semibold">
        {plan.price}
        {plan.period && <span className="text-sm font-normal text-muted-foreground">{plan.period}</span>}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {plan.features.map((f) => (
          <li key={f}>· {f}</li>
        ))}
      </ul>
      {plan.waitlistSource && BILLING_ENABLED && plan.slug !== "free" ? (
        <BuyButtons plan={plan.slug as PaidPlan} />
      ) : plan.waitlistSource ? (
        <Waitlist source={plan.waitlistSource} planName={plan.name} />
      ) : (
        <Button className="mt-5 w-full" variant={plan.highlight ? "default" : "outline"} onClick={onStart}>
          Começar grátis
        </Button>
      )}
    </div>
  );
}

const BILLING_ENABLED = import.meta.env["VITE_BILLING_ENABLED"] === "true";

function BuyButtons({ plan }: { plan: PaidPlan }) {
  const checkout = useServerFn(createCheckout);
  const [busy, setBusy] = useState<BillingPeriod | null>(null);
  async function buy(period: BillingPeriod) {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      toast("Entre na sua conta para assinar.");
      window.location.href = "/entrar";
      return;
    }
    setBusy(period);
    try {
      const r = await checkout({ data: { plan, period } });
      if (r.url) window.location.href = r.url;
      else toast.error(r.error ?? "Não foi possível abrir o pagamento.");
    } catch {
      toast.error("Não foi possível abrir o pagamento. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }
  const periods = (Object.keys(PRICES_CENTS[plan]) as BillingPeriod[]);
  return (
    <div className="mt-5 space-y-2">
      {periods.map((p) => (
        <Button key={p} className="w-full" variant={p === "mensal" ? "default" : "outline"} disabled={busy !== null} onClick={() => buy(p)}>
          {busy === p ? "Abrindo…" : `Assinar ${p} · ${formatCents(PRICES_CENTS[plan][p]!)}`}
        </Button>
      ))}
      <p className="text-xs text-muted-foreground">Pagamento pelo Mercado Pago: cartão, Pix ou boleto.</p>
    </div>
  );
}

const formatCents = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Waitlist({ source, planName }: { source: string; planName: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const id = `wl-${source}`;

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return;
    setSending(true);
    const { error } = await supabase.from("leads").insert({ email: email.trim(), consent_marketing: true, source });
    setSending(false);
    if (error) {
      toast.error("Não foi possível salvar o e-mail. Confira o endereço e tente de novo.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="mt-5 text-sm" role="status">
        Pronto. Avisamos você por e-mail quando o {planName} lançar.
      </p>
    );
  }
  return (
    <form onSubmit={join} className="mt-5 space-y-3">
      <label htmlFor={id} className="text-sm font-semibold">
        Avisar quando lançar
      </label>
      <Input id={id} type="email" required placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
        Aceito receber e-mails sobre o lançamento.
      </label>
      <Button type="submit" variant="outline" className="w-full" disabled={!consent || sending}>
        {sending ? "Enviando…" : "Quero ser avisado"}
      </Button>
    </form>
  );
}

export function Faq() {
  const qs: [string, string][] = [
    ["Isso é um investimento?", "Não. É um programa de educação e planejamento. Você escolhe onde e como investir."],
    ["Preciso dar dados do meu banco?", "Não. Você só informa valores aproximados, se quiser."],
    ["Quanto tempo por dia?", "Cerca de 5 minutos por lição."],
    ["E se eu perder um dia?", "Tudo bem. Até dois dias por semana ficam protegidos e sua sequência continua."],
    ["Tem ranking de patrimônio?", "Não. Você só se compara com você mesmo. O app reconhece hábitos e progresso, nunca quanto dinheiro alguém tem."],
    ["Os valores são garantidos?", "Não. São simulações com premissas que você vê e pode mudar."],
  ];
  return (
    <section className="mt-16">
      <h2>Perguntas frequentes</h2>
      <Accordion type="single" collapsible className="mt-4">
        {qs.map(([q, a]) => (
          <AccordionItem key={q} value={q}>
            <AccordionTrigger className="text-left">{q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
