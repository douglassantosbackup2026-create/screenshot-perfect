import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { LESSONS } from "@/content/program";
import { FREE_FEATURES, PREMIUM_FEATURES, PREMIUM_PRICE } from "@/content/pricing";

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
          <div key={t} className="rounded-2xl border border-border bg-card p-4">
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
    "Uma lição de 5 minutos por dia.",
    "No dia 14, seu plano fica pronto.",
    "Todo mês, você registra seu aporte e vê o fio da constância crescer.",
  ];
  return (
    <section className="mt-16">
      <h2>Como funciona</h2>
      <ol className="mt-5 space-y-4">
        {steps.map((t, i) => (
          <li key={t} className="flex gap-4">
            <span className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-primary">
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
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Hoje · Dia 3 de 21</p>
          <p className="mt-1 font-semibold">Inflação: o inimigo silencioso</p>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div className="h-2 w-[14%] rounded-full bg-accent" />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Plano</p>
          <p className="mt-1 font-semibold">Três cenários, premissas sempre visíveis</p>
          <div className="mt-3 flex items-end gap-2" aria-hidden>
            {[30, 45, 60].map((h) => (
              <div key={h} className="w-8 rounded-t bg-primary/70" style={{ height: h }} />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
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
  const weeks = [LESSONS.slice(0, 7), LESSONS.slice(7, 14), LESSONS.slice(14, 21)];
  return (
    <section className="mt-16">
      <h2>Os 21 dias</h2>
      <Accordion type="single" collapsible className="mt-4">
        {weeks.map((w, i) => (
          <AccordionItem key={i} value={`s${i}`}>
            <AccordionTrigger>Semana {i + 1}</AccordionTrigger>
            <AccordionContent>
              <ol className="space-y-2">
                {w.map((l) => (
                  <li key={l.day} className="flex gap-3 text-sm">
                    <span className="w-12 shrink-0 text-muted-foreground">Dia {l.day}</span>
                    <span>{l.title}</span>
                  </li>
                ))}
              </ol>
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
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return;
    setSending(true);
    const { error } = await supabase.from("leads").insert({ email: email.trim(), consent_marketing: true, source: "premium_waitlist" });
    setSending(false);
    if (error) {
      toast.error("Não foi possível salvar o e-mail. Confira o endereço e tente de novo.");
      return;
    }
    setSent(true);
  }

  return (
    <section className="mt-16" aria-label="Planos">
      <h2>Planos</h2>
      <div className="mt-5 space-y-4">
        <div className="rounded-2xl border-2 border-primary bg-card p-5">
          <p className="font-display text-xl font-semibold">Gratuito</p>
          <p className="money mt-1 text-2xl font-semibold">R$ 0</p>
          <ul className="mt-4 space-y-2 text-sm">
            {FREE_FEATURES.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
          <Button className="mt-5 w-full" onClick={onStart}>
            Começar grátis
          </Button>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-xl font-semibold">Premium</p>
            <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Em breve</span>
          </div>
          <p className="money mt-1 text-2xl font-semibold">
            {PREMIUM_PRICE.monthly}
            <span className="text-sm font-normal text-muted-foreground">/mês</span>
          </p>
          <p className="money text-sm text-muted-foreground">ou {PREMIUM_PRICE.yearly} por ano</p>
          <ul className="mt-4 space-y-2 text-sm">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
          {sent ? (
            <p className="mt-5 text-sm" role="status">
              Pronto. Avisamos você por e-mail quando o Premium lançar.
            </p>
          ) : (
            <form onSubmit={join} className="mt-5 space-y-3">
              <label htmlFor="wl-email" className="text-sm font-semibold">
                Avisar quando lançar
              </label>
              <Input id="wl-email" type="email" required placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
                Aceito receber e-mails sobre o lançamento.
              </label>
              <Button type="submit" variant="outline" className="w-full" disabled={!consent || sending}>
                {sending ? "Enviando…" : "Quero ser avisado"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

export function Faq() {
  const qs: [string, string][] = [
    ["Isso é um investimento?", "Não. É um programa de educação e planejamento. Você escolhe onde e como investir."],
    ["Preciso dar dados do meu banco?", "Não. Você só informa valores aproximados, se quiser."],
    ["Quanto tempo por dia?", "Cerca de 5 minutos por lição."],
    ["E se eu perder um dia?", "Tudo bem. Você continua de onde parou, sem perder nada."],
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
