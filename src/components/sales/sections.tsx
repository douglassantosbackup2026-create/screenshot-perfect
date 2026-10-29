import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LESSONS } from "@/content/program";
import { UNITS } from "@/content/journey";
import { PLANS, PRICING_NOTE, type PlanTier } from "@/content/pricing";
import { JOURNEY_ENABLED } from "@/lib/features";
import { APP_NAME } from "@/lib/seo";
import { PillarCards } from "@/components/PillarCards";
import { saveLead } from "@/lib/data/leads";

export function ThreeInOne() {
  return (
    <section className="mt-16" aria-label="Três apps em um">
      <h2>Três apps em um</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        O {APP_NAME} junta o que hoje fica espalhado em apps e planilhas diferentes.
      </p>
      <div className="mt-5">
        <PillarCards show="replaces" />
      </div>
    </section>
  );
}

export function Problem() {
  const items = [
    ["Três apps, nenhuma visão do todo.", "O gasto do mês fica num app, os investimentos em outro e a aposentadoria numa planilha. Ninguém liga uma coisa à outra."],
    ["O INSS sozinho costuma não bastar.", "O teto é limitado e as regras mudam. Contar só com ele é arriscado."],
    ["O difícil é manter.", "Começar é fácil. O que faz diferença é fechar o mês e guardar todo mês, por anos."],
  ];
  return (
    <section className="mt-16">
      <h2>Por que num app só</h2>
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
  const steps = JOURNEY_ENABLED
    ? [
        "Jornada: lições de 2 a 5 minutos em 4 unidades, com missão do dia, XP e sequência sem punição por pausas.",
        "Na Unidade 2, seu plano de aposentadoria fica pronto.",
        "Progresso: todo mês, você registra aporte e patrimônio e vê seu avanço rumo à independência.",
      ]
    : [
        "Registre o mês: lançamentos, contas e orçamento, e feche o mês em poucos minutos.",
        "Veja o patrimônio: tudo o que você tem e deve, e como isso muda mês a mês.",
        "Siga o plano: quanto guardar por mês para se aposentar sem depender do INSS.",
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
        {JOURNEY_ENABLED && (
          <div className="rounded-2xl bg-card shadow-card p-4">
            <p className="text-xs text-muted-foreground">Jornada · Unidade 1 · Lição 2 de 5</p>
            <p className="mt-1 font-semibold">{LESSONS[1]?.title}</p>
            <div className="mt-3 h-2 rounded-full bg-muted">
              <div className="h-2 w-[14%] rounded-full bg-accent" />
            </div>
          </div>
        )}
        <div className="rounded-2xl bg-card shadow-card p-4">
          <p className="text-xs text-muted-foreground">Dinheiro · Lançamentos e Orçamento</p>
          <p className="mt-1 font-semibold">Cada gasto em segundos, cada real com destino</p>
          <div className="mt-3 flex gap-1.5" aria-hidden>
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className={`h-3 w-3 rounded-full ${i < 6 ? "bg-accent" : "bg-muted"}`} />
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-card shadow-card p-4">
          <p className="text-xs text-muted-foreground">Futuro · Patrimônio</p>
          <p className="mt-1 font-semibold">Tudo o que você tem e deve, num lugar só</p>
          <div className="mt-3 h-2 rounded-full bg-muted">
            <div className="h-2 w-[38%] rounded-full bg-accent" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Investimentos, previdência, imóveis e dívidas, mês a mês.</p>
        </div>
        <div className="rounded-2xl bg-card shadow-card p-4">
          <p className="text-xs text-muted-foreground">Futuro · Plano</p>
          <p className="mt-1 font-semibold">Aposentadoria em três cenários, premissas sempre visíveis</p>
          <div className="mt-3 flex items-end gap-2" aria-hidden>
            {[30, 45, 60].map((h) => (
              <div key={h} className="w-8 rounded-t bg-primary/70" style={{ height: h }} />
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-card shadow-card p-4">
          <p className="text-xs text-muted-foreground">Progresso</p>
          <p className="mt-1 font-semibold">Seu avanço comparado só com você mesmo</p>
          <p className="mt-2 text-xs text-muted-foreground">Metas, aportes e a linha do tempo do patrimônio.</p>
        </div>
      </div>
    </section>
  );
}

export function Curriculum() {
  if (!JOURNEY_ENABLED) return null;
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
    <section id="planos" className="mt-16 scroll-mt-6" aria-label="Planos">
      <h2>Planos</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Uma assinatura com tudo: orçamento, patrimônio e aposentadoria. Vendemos clareza, nunca produtos financeiros.
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
        <span className="text-sm font-normal text-muted-foreground">{plan.period}</span>
      </p>
      {plan.annualNote && <p className="text-sm text-muted-foreground">{plan.annualNote}</p>}
      <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {plan.features.map((f) => (
          <li key={f}>· {f}</li>
        ))}
      </ul>
      {plan.waitlistSource ? (
        <Waitlist source={plan.waitlistSource} planName={plan.name} />
      ) : (
        <Button className="mt-5 w-full" onClick={onStart}>
          Assinar o {APP_NAME}
        </Button>
      )}
    </div>
  );
}


export function Waitlist({ source, planName }: { source: string; planName: string }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const id = `wl-${source}`;

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return;
    setSending(true);
    const ok = await saveLead(email, source);
    setSending(false);
    if (ok) setSent(true);
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
    [
      "Ainda vou precisar de outros apps de controle financeiro?",
      `Não. O ${APP_NAME} cobre o orçamento do mês, o patrimônio e o plano de aposentadoria. Se você usa uma planilha de gastos, dá para importar o extrato.`,
    ],
    ["Tem plano grátis?", "Não. A calculadora é aberta para todos; o app é por assinatura, e você cancela quando quiser."],
    ["Vocês vendem investimentos?", "Não. É uma ferramenta de educação e planejamento. Você escolhe onde e como investir."],
    ["Preciso dar dados do meu banco?", "Não. Você lança os valores ou importa o extrato, se quiser. Nunca pedimos senha."],
    ...(JOURNEY_ENABLED
      ? ([
          ["Quanto tempo por dia?", "Cerca de 5 minutos por lição."],
          ["E se eu perder um dia?", "Tudo bem. Até dois dias por semana ficam protegidos e sua sequência continua."],
        ] as [string, string][])
      : []),
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
