// Executa uma mensagem do WhatsApp: quem é, se pode usar, o plano do pipeline e a gravação no estado da pessoa.
// Só no servidor (usa o service_role). A decisão fica em pipeline.ts; aqui é só ler, gravar e responder.
import { addTransactionTo, deleteTransactionIn, parseStoredState, updateTransactionIn } from "@/lib/data/demo-store";
import { readState, updateState as updateStateIn, type Admin } from "@/lib/data/server-state";
import { resolveAccess } from "@/lib/entitlements/matrix";
import { APP_NAME } from "@/lib/seo";
import type { Inbound } from "./inbound";
import type { Outbound } from "./outbound";
import { addedReply, categoryChangedReply, deletedReply, help, planReply, planText, type Ctx, type Plan } from "./pipeline";

type Link = { user_id: string; discreet: boolean; last_tx_id: string | null };

const BILLING_ENABLED = import.meta.env["VITE_BILLING_ENABLED"] === "true";
const BUSY = "Seus dados estavam sendo salvos ao mesmo tempo no app. Mande de novo, por favor.";
const updateState = <T,>(db: Admin, userId: string, change: Parameters<typeof updateStateIn<T>>[2]) => updateStateIn(db, userId, change, BUSY);

const text = (t: string): Outbound => ({ kind: "text", text: t });

/** Processa uma mensagem e devolve a resposta (ou null quando não há o que responder). */
export async function handleInbound(msg: Inbound, now = new Date()): Promise<Outbound | null> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  // A mesma notificação pode chegar de novo: só a primeira é processada.
  const fresh = await db.from("whatsapp_messages").insert({ id: msg.id }).select("id");
  if (fresh.error) {
    if (fresh.error.code === "23505") return null;
    throw new Error(`whatsapp_messages: ${fresh.error.message}`);
  }

  // Código de conexão vale mesmo para número ainda não conectado.
  if (msg.kind === "text") {
    const early = planText(emptyState, msg.text, { now, discreet: false, lastTxId: null });
    if (early.kind === "link") return linkNumber(db, msg.from, early.code, now);
  }

  const { data: link, error } = await db.from("whatsapp_links").select("user_id, discreet, last_tx_id").eq("phone", msg.from).maybeSingle();
  if (error) throw new Error(`whatsapp_links: ${error.message}`);
  if (!link) {
    return text(`Oi! Para usar o ${APP_NAME} por aqui, conecte este número no app: Perfil › WhatsApp › Conectar.`);
  }
  if (!(await hasAccess(db, link.user_id, now))) {
    return text(`Sua assinatura do ${APP_NAME} não está ativa. Assine no app (Assinatura) para voltar a lançar por aqui.`);
  }

  const loaded = await readState(db, link.user_id);
  if (!loaded) return text(`Abra o ${APP_NAME} no celular ou no computador uma vez para terminar a configuração, e depois me mande de novo.`);
  const ctx: Ctx = { now, discreet: link.discreet, lastTxId: link.last_tx_id };

  let plan: Plan;
  if (msg.kind === "text") plan = planText(loaded.state, msg.text, ctx);
  else if (msg.kind === "reply") plan = planReply(loaded.state, msg.reply);
  else if (msg.kind === "media") return text("Ler foto de nota e comprovante chega em breve. Por enquanto, mande o gasto por texto: \"gastei 62 na farmácia\".");
  else return help();

  return runPlan(db, link, plan, ctx);
}

async function runPlan(db: Admin, link: Link, plan: Plan, ctx: Ctx): Promise<Outbound> {
  switch (plan.kind) {
    case "reply":
      return plan.reply;
    case "link":
      return text("Este número já está conectado.");
    case "add": {
      const r = await updateState(db, link.user_id, (s) => addTransactionTo(s, plan.input, ctx.now));
      if (!r.ok) return text(r.message);
      await db.from("whatsapp_links").update({ last_tx_id: r.result.id, updated_at: new Date().toISOString() }).eq("user_id", link.user_id);
      return addedReply(r.state, r.result, ctx);
    }
    case "delete": {
      const r = await updateState(db, link.user_id, (s) => deleteTransactionIn(s, plan.txId));
      if (!r.ok) return text(r.message);
      if (link.last_tx_id === plan.txId) await db.from("whatsapp_links").update({ last_tx_id: null }).eq("user_id", link.user_id);
      return r.result ? deletedReply() : text("Esse lançamento já não existe.");
    }
    case "setCategory": {
      const r = await updateState(db, link.user_id, (s) => updateTransactionIn(s, plan.txId, { categoryId: plan.categoryId, remember: true }));
      if (!r.ok) return text(r.message);
      return categoryChangedReply(r.state, plan.txId);
    }
  }
}

/** Liga o número à conta que gerou o código. Um número fica em uma conta só. */
async function linkNumber(db: Admin, phone: string, code: string, now: Date): Promise<Outbound> {
  const { data: row } = await db.from("whatsapp_link_codes").select("user_id, expires_at").eq("code", code).maybeSingle();
  if (!row || new Date(row.expires_at).getTime() < now.getTime()) {
    return text("Esse código não vale mais. Gere outro no app: Perfil › WhatsApp › Conectar.");
  }
  await db.from("whatsapp_links").delete().eq("phone", phone).neq("user_id", row.user_id);
  const saved = await db
    .from("whatsapp_links")
    .upsert({ user_id: row.user_id, phone, verified_at: now.toISOString(), last_tx_id: null, updated_at: now.toISOString() });
  if (saved.error) throw new Error(`whatsapp_links upsert: ${saved.error.message}`);
  await db.from("whatsapp_link_codes").delete().eq("user_id", row.user_id);
  return text(`✅ Número conectado ao ${APP_NAME}!\n\n${(help() as { text: string }).text}`);
}

async function hasAccess(db: Admin, userId: string, now: Date): Promise<boolean> {
  if (!BILLING_ENABLED) return true;
  const { data } = await db.from("entitlements").select("plan, valid_until").eq("user_id", userId).maybeSingle();
  return resolveAccess({ billingEnabled: true, entitlement: data ? { plan: data.plan, validUntil: data.valid_until } : null, now }).active;
}

// Estado vazio só para reconhecer o código de conexão antes de saber de quem é o número.
const emptyState = parseStoredState({});
