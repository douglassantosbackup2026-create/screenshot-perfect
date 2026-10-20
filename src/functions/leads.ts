// Leads da calculadora e da lista de espera, com o e-mail do resultado (Resend).
// Função de servidor do TanStack (não Edge Function). Grava pela chave pública: a tabela leads aceita só inserção.
// O resultado do e-mail é recalculado aqui com src/lib/calc, nunca copiado do que o navegador mandou.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabase } from "@/integrations/supabase/client";
import { simulate, validateInputs, type PlanInputs } from "@/lib/calc/retirement";
import { formatMonthly, formatPercent, formatWealth } from "@/lib/calc/format";
import { DEFAULT_ASSUMPTIONS } from "@/lib/data/demo-store";

export type LeadSimulation = {
  currentAge: number;
  retirementAge: number;
  desiredIncome: number;
  initialWealth: number | null;
  monthlyContribution: number | null;
  inssEstimate: number | null;
};
export type LeadInput = {
  email: string;
  source: "calculadora" | "lista_espera";
  simulation: LeadSimulation | null;
  utm: { source: string | null; medium: string | null; campaign: string | null };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const short = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 80) : null);
const n = (v: unknown, min: number, max: number) => (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null);

export function validateLead(d: unknown): LeadInput {
  const x = (d ?? {}) as Record<string, unknown>;
  const email = String(x["email"] ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) throw new Error("E-mail inválido.");
  const source = x["source"] === "lista_espera" ? "lista_espera" : "calculadora";
  const sim = x["simulation"] as Record<string, unknown> | null | undefined;
  const simulation: LeadSimulation | null =
    sim && n(sim["currentAge"], 16, 90) && n(sim["retirementAge"], 30, 90) && n(sim["desiredIncome"], 1, 1e7)
      ? {
          currentAge: sim["currentAge"] as number,
          retirementAge: sim["retirementAge"] as number,
          desiredIncome: sim["desiredIncome"] as number,
          initialWealth: n(sim["initialWealth"], 0, 1e10),
          monthlyContribution: n(sim["monthlyContribution"], 0, 1e8),
          inssEstimate: n(sim["inssEstimate"], 1, 1e6),
        }
      : null;
  const utm = (x["utm"] ?? {}) as Record<string, unknown>;
  return { email, source, simulation, utm: { source: short(utm["source"]), medium: short(utm["medium"]), campaign: short(utm["campaign"]) } };
}

export function inputsOf(s: LeadSimulation): PlanInputs {
  return {
    ...DEFAULT_ASSUMPTIONS,
    returns: { ...DEFAULT_ASSUMPTIONS.returns },
    currentAge: s.currentAge,
    retirementAge: s.retirementAge,
    initialWealth: s.initialWealth ?? 0,
    monthlyContribution: s.monthlyContribution ?? 0,
    desiredMonthlyIncome: s.desiredIncome,
    inssEstimate: s.inssEstimate,
  };
}

/** Link que reabre a calculadora com os mesmos números. */
export function calculatorLink(origin: string, s: LeadSimulation) {
  const q = new URLSearchParams({ idade: String(s.currentAge), aposentar: String(s.retirementAge), renda: String(s.desiredIncome) });
  if (s.initialWealth != null) q.set("patrimonio", String(s.initialWealth));
  if (s.monthlyContribution != null) q.set("aporte", String(s.monthlyContribution));
  if (s.inssEstimate != null) q.set("inss", String(s.inssEstimate));
  return `${origin.replace(/\/+$/, "")}/calculadora?${q.toString()}`;
}

/** E-mail do resultado, em HTML simples (estilos inline, como pedem os clientes de e-mail). */
export function resultEmail(s: LeadSimulation, link: string) {
  const r = simulate(inputsOf(s), "central", false);
  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 0;color:#c3c2b7">${label}</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#f0efec">${value}</td></tr>`;
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#0c0c0b;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:32px 24px;color:#f0efec">
<p style="color:#f6c800;font-weight:700;letter-spacing:.08em;font-size:12px;text-transform:uppercase">Previdência Intelligence</p>
<h1 style="font-size:24px;line-height:1.3;margin:8px 0 16px">Seu resultado: aposentadoria sem depender do INSS</h1>
<p style="color:#c3c2b7">Para ter ${formatMonthly(s.desiredIncome)} por mês a partir dos ${s.retirementAge} anos, sem contar com o INSS, no cenário central:</p>
<p style="font-size:32px;font-weight:700;color:#f6c800;margin:16px 0">${formatMonthly(r.requiredMonthlyContribution)} por mês</p>
<table style="width:100%;border-collapse:collapse;font-size:14px">
${row("Patrimônio projetado aos " + s.retirementAge, formatWealth(r.projectedWealthAtRetirement))}
${row("Renda que ele sustentaria", formatMonthly(r.sustainableMonthlyIncome))}
${row("Quanto da renda desejada isso cobre", formatPercent(r.coverageRatio))}
</table>
<p style="margin:28px 0"><a href="${link}" style="background:#f6c800;color:#0c0c0b;padding:14px 22px;border-radius:999px;font-weight:700;text-decoration:none">Rever e montar meu plano</a></p>
<p style="color:#8a8984;font-size:12px;line-height:1.5">Simulação educativa, em valores de hoje, com retorno real de ${formatPercent(DEFAULT_ASSUMPTIONS.returns.central)} ao ano. Não é recomendação de investimento.
Você recebeu este e-mail porque pediu o resultado na calculadora. Para não receber mais nada, responda com "sair".</p>
</div></body></html>`;
  const text = `Para ter ${formatMonthly(s.desiredIncome)} por mês a partir dos ${s.retirementAge} anos, sem o INSS, guarde cerca de ${formatMonthly(r.requiredMonthlyContribution)} por mês (cenário central). Reveja: ${link}`;
  return { subject: `Seu resultado: ${formatMonthly(r.requiredMonthlyContribution)} por mês para se aposentar sem o INSS`, html, text };
}

function origin(): string {
  const fromEnv = process.env["PUBLIC_SITE_URL"];
  if (fromEnv) return fromEnv;
  try {
    const req = getRequest();
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "";
  }
}

async function sendEmail(to: string, msg: { subject: string; html: string; text: string }) {
  const key = process.env["RESEND_API_KEY"];
  const from = process.env["RESEND_FROM"] ?? "Previdência Intelligence <resultado@resend.dev>";
  if (!key) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: msg.subject, html: msg.html, text: msg.text }),
  });
  return res.ok;
}

/**
 * Grava o lead (um por e-mail) e, na primeira vez, envia o resultado por e-mail.
 * Devolve `sent` para a tela dizer a verdade: só promete o e-mail quando ele saiu.
 */
export const submitLead = createServerFn({ method: "POST" })
  .validator(validateLead)
  .handler(async ({ data }) => {
    const row = {
      email: data.email,
      consent_marketing: true,
      source: data.source,
      simulation: data.simulation,
      utm_source: data.utm.source,
      utm_medium: data.utm.medium,
      utm_campaign: data.utm.campaign,
    };
    let { error } = await supabase.from("leads").insert(row as never);
    // Sem a migração 20261030120000_leads (colunas novas), grava só o essencial.
    if (error && /simulation|utm_/.test(error.message)) ({ error } = await supabase.from("leads").insert({ email: data.email, consent_marketing: true, source: data.source }));
    const duplicate = !!error && (error.code === "23505" || /duplicate/i.test(error.message));
    if (error && !duplicate) throw new Error("Não foi possível salvar o e-mail agora.");
    // Um e-mail por endereço: repetir o pedido não reenvia (evita usar o formulário para mandar spam).
    if (duplicate || !data.simulation) return { saved: true, sent: false, duplicate };
    const sent = await sendEmail(data.email, resultEmail(data.simulation, calculatorLink(origin(), data.simulation))).catch(() => false);
    return { saved: true, sent, duplicate: false };
  });
