// Decide o que fazer com cada mensagem do WhatsApp. Funções puras: recebem o estado da pessoa e devolvem
// um plano (lançar, desfazer, trocar categoria, só responder). Quem grava no banco e envia é a rota do
// webhook. Os números das respostas vêm das mesmas funções do app (selectors, calc), nunca de texto livre.
import type { DemoState, NewTxInput, Transaction } from "@/lib/data/demo-store";
import { quickEntryDraft, ledgerMonth } from "@/lib/data/selectors";
import { formatMoney } from "@/lib/calc/format";
import { monthOf, spDate } from "@/lib/gamification/rules";
import { dayLabel, monthYear } from "@/lib/labels";
import { APP_NAME } from "@/lib/seo";
import type { Outbound } from "./outbound";

export type Ctx = {
  now: Date;
  /** Modo discreto: valores aparecem como "R$ •••". */
  discreet: boolean;
  /** Último lançamento feito pelo WhatsApp (para "desfazer" por texto). */
  lastTxId: string | null;
};

export type Plan =
  | { kind: "reply"; reply: Outbound }
  | { kind: "link"; code: string }
  | { kind: "add"; input: NewTxInput }
  | { kind: "delete"; txId: string }
  | { kind: "setCategory"; txId: string; categoryId: string };

const LINK = /^mitikos-([a-z0-9]{6})$/i;
const HELP = /^(ajuda|menu|help|oi|ol[aá]|bom dia|boa tarde|boa noite|come[cç]ar)\b/i;

export function planText(s: DemoState, text: string, ctx: Ctx): Plan {
  const t = text.trim();
  const link = t.match(LINK);
  if (link) return { kind: "link", code: link[1]!.toUpperCase() };
  if (HELP.test(t)) return { kind: "reply", reply: help() };
  if (/^desfa(z|zer)\b/i.test(t)) {
    return ctx.lastTxId ? { kind: "delete", txId: ctx.lastTxId } : reply("Não achei um lançamento recente feito por aqui para desfazer.");
  }
  if (/^resumo\b/i.test(t)) return { kind: "reply", reply: monthSummary(s, ctx) };

  const { parsed, draft } = quickEntryDraft(s, t, ctx.now);
  if (parsed.missing.includes("valor")) {
    return reply(`Não entendi o valor. Tente assim: "gastei 62 na farmácia" ou "recebi 800 do freela". Mande *ajuda* para ver o que eu sei fazer.`);
  }
  if (parsed.missing.includes("descricao")) return reply(`Faltou dizer com o quê. Ex.: "${formatMoney(draft.amount ?? 0)} mercado".`);
  if (draft.installments) return reply(`Compras parceladas ainda são lançadas pelo app, em Lançamentos. Por aqui eu lanço gastos e entradas à vista.`);
  const accountId = defaultAccountId(s);
  if (!accountId) return reply(`Cadastre uma conta no app (Dinheiro › Contas) para eu poder lançar por aqui.`);
  const amount = draft.amount ?? 0;
  return {
    kind: "add",
    input: { accountId, date: draft.date, amount: draft.kind === "entrada" ? amount : -amount, payee: draft.payee, categoryId: draft.categoryId },
  };
}

/** Toque num botão ou numa linha de lista que o Mitikos enviou. */
export function planReply(s: DemoState, id: string): Plan {
  const [action, txId, categoryId] = id.split(":");
  if (!txId) return reply("Esse botão expirou. Mande a mensagem de novo.");
  const tx = s.transactions.find((t) => t.id === txId);
  if (action === "undo") return tx ? { kind: "delete", txId } : reply("Esse lançamento já não existe.");
  if (!tx) return reply("Esse lançamento já não existe. Ele pode ter sido apagado no app.");
  if (action === "cat") return { kind: "reply", reply: categoryList(s, tx) };
  if (action === "setcat" && categoryId && s.categories.some((c) => c.id === categoryId)) return { kind: "setCategory", txId, categoryId };
  return reply("Não reconheci esse botão. Mande a mensagem de novo.");
}

/** Resposta depois de lançar: o que entrou, onde, e os botões para desfazer ou corrigir. */
export function addedReply(s: DemoState, tx: Transaction, ctx: Ctx): Outbound {
  const category = tx.categoryId ? s.categories.find((c) => c.id === tx.categoryId)?.name : null;
  const account = s.accounts.find((a) => a.id === tx.accountId)?.name ?? "conta";
  const when = tx.date === spDate(ctx.now) ? "hoje" : dayLabel(tx.date);
  const verb = tx.amount > 0 ? "Entrada de" : "Lancei";
  return {
    kind: "buttons",
    text: `✅ ${verb} *${money(Math.abs(tx.amount), ctx)}* · ${tx.payee}\n${category ?? "Sem categoria"} · ${account} · ${when}`,
    buttons: [
      { id: `undo:${tx.id}`, title: "Desfazer" },
      { id: `cat:${tx.id}`, title: category ? "Mudar categoria" : "Escolher categoria" },
    ],
  };
}

export function deletedReply(): Outbound {
  return { kind: "text", text: "↩️ Desfeito. O lançamento saiu do app também." };
}

export function categoryChangedReply(s: DemoState, txId: string): Outbound {
  const tx = s.transactions.find((t) => t.id === txId);
  const name = tx?.categoryId ? s.categories.find((c) => c.id === tx.categoryId)?.name : null;
  return { kind: "text", text: `🏷️ Pronto: ${tx?.payee ?? "lançamento"} agora está em ${name ?? "Sem categoria"}.` };
}

/** Lista de categorias do tipo certo (gasto ou receita), as mais usadas nos últimos 90 dias primeiro. */
export function categoryList(s: DemoState, tx: Transaction): Outbound {
  const kind = tx.amount > 0 ? "receita" : "despesa";
  const uses = new Map<string, number>();
  for (const t of s.transactions) if (t.categoryId) uses.set(t.categoryId, (uses.get(t.categoryId) ?? 0) + 1);
  const rows = s.categories
    .filter((c) => c.kind === kind && c.id !== tx.categoryId)
    .sort((a, b) => (uses.get(b.id) ?? 0) - (uses.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map((c) => ({ id: `setcat:${tx.id}:${c.id}`, title: c.name }));
  return { kind: "list", text: `Em qual categoria fica "${tx.payee}"?`, button: "Ver categorias", rows };
}

/** "resumo": entradas, saídas e o que sobrou no mês, pelas mesmas contas da tela de Lançamentos. */
export function monthSummary(s: DemoState, ctx: Ctx): Outbound {
  const month = monthOf(spDate(ctx.now));
  const m = ledgerMonth(s, month);
  const top = m.byCategory[0];
  const lines = [
    `📊 *${monthYear(month)}* até agora`,
    `Entradas: ${money(m.summary.income, ctx)}`,
    `Saídas: ${money(m.summary.expense, ctx)}`,
    `${m.summary.net >= 0 ? "Sobrou" : "Faltou"}: *${money(Math.abs(m.summary.net), ctx)}*`,
  ];
  if (top) lines.push(`Maior gasto: ${top.name} (${money(top.amount, ctx)})`);
  if (m.uncategorized) lines.push(`${m.uncategorized} sem categoria: dá para resolver no fechamento do mês, no app.`);
  return { kind: "text", text: lines.join("\n") };
}

export function help(): Outbound {
  return {
    kind: "text",
    text: [
      `Oi! Eu sou o ${APP_NAME} no WhatsApp. Por aqui você pode:`,
      `• Lançar: "gastei 62 na farmácia", "uber 23", "recebi 800 do freela"`,
      `• Ver o mês: "resumo"`,
      `• Desfazer o último: "desfazer"`,
      `Tudo o que você lança aqui aparece no app na hora.`,
    ].join("\n"),
  };
}

/** Conta padrão para lançar: a do lançamento mais recente feito à mão; sem nenhum, a primeira conta do dia a dia. */
export function defaultAccountId(s: DemoState): string | null {
  const ids = new Set(s.accounts.map((a) => a.id));
  const recent = [...s.transactions]
    .filter((t) => !t.transferId && !t.recurringId && ids.has(t.accountId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (recent) return recent.accountId;
  const everyday = s.accounts.find((a) => a.kind === "corrente" || a.kind === "cartao" || a.kind === "carteira");
  return (everyday ?? s.accounts[0])?.id ?? null;
}

const money = (cents: number, ctx: Ctx) => (ctx.discreet ? "R$ •••" : formatMoney(cents));
const reply = (text: string): Plan => ({ kind: "reply", reply: { kind: "text", text } });
