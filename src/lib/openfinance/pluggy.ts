// Provedor Pluggy (api.pluggy.ai). Só no servidor: lê PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET a cada chamada.
// Contas BANK/CREDIT viram corrente/poupança/cartão; investimentos (inclusive PGBL/VGBL) viram contas
// "previdencia"/"investimento" com id "inv:<id>", sem lançamentos, só saldo.
import type { AccountKind } from "@/lib/calc/ledger";
import type { OpenFinanceProvider, ProviderAccount, ProviderTx, WebhookEvent } from "./provider";
import { pluggyAccountKind, pluggyInvestmentKind, pluggyTxCents, INVESTMENT_PREFIX } from "@/lib/calc/bankSync";

const API = "https://api.pluggy.ai";

async function apiKey(): Promise<string> {
  const clientId = process.env["PLUGGY_CLIENT_ID"];
  const clientSecret = process.env["PLUGGY_CLIENT_SECRET"];
  if (!clientId || !clientSecret) throw new Error("Pluggy sem credenciais");
  const r = await fetch(`${API}/auth`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, clientSecret }) });
  if (!r.ok) throw new Error(`Pluggy auth [${r.status}]: ${await r.text()}`);
  return ((await r.json()) as { apiKey: string }).apiKey;
}

async function get<T>(path: string, key: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { "X-API-KEY": key } });
  if (!r.ok) throw new Error(`Pluggy ${path.split("?")[0]} [${r.status}]: ${await r.text()}`);
  return (await r.json()) as T;
}

const toCents = (v: number) => Math.round(v * 100);

type PAccount = { id: string; type: string; subtype?: string | null; name: string; marketingName?: string | null; balance: number };
type PInvestment = { id: string; name: string; type: string; balance: number | null; amount?: number | null };
type PTx = { id: string; date: string; amount: number; type?: string | null; description: string; descriptionRaw?: string | null };

export const pluggyProvider: OpenFinanceProvider = {
  name: "pluggy",
  async createConnectToken(userId) {
    const key = await apiKey();
    const secret = process.env["OPEN_FINANCE_WEBHOOK_SECRET"];
    const base = process.env["PUBLIC_APP_URL"] ?? "https://planejafacil.site";
    const body: Record<string, unknown> = { clientUserId: userId };
    if (secret) body["webhookUrl"] = `${base}/api/public/openfinance/webhook?secret=${encodeURIComponent(secret)}`;
    const r = await fetch(`${API}/connect_token`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-KEY": key }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`Pluggy connect_token [${r.status}]: ${await r.text()}`);
    return ((await r.json()) as { accessToken: string }).accessToken;
  },
  async listAccounts(itemId) {
    const key = await apiKey();
    const [acc, inv] = await Promise.all([
      get<{ results: PAccount[] }>(`/accounts?itemId=${encodeURIComponent(itemId)}`, key),
      get<{ results: PInvestment[] }>(`/investments?itemId=${encodeURIComponent(itemId)}`, key).catch(() => ({ results: [] as PInvestment[] })),
    ]);
    const out: ProviderAccount[] = acc.results.map((a) => {
      const kind: AccountKind = pluggyAccountKind(a.type, a.subtype ?? null);
      const cents = toCents(a.balance ?? 0);
      return { id: a.id, name: a.marketingName || a.name, kind, balanceCents: kind === "cartao" ? -Math.abs(cents) : cents };
    });
    for (const i of inv.results) {
      out.push({ id: INVESTMENT_PREFIX + i.id, name: i.name, kind: pluggyInvestmentKind(i.type, i.name), balanceCents: toCents(i.balance ?? i.amount ?? 0) });
    }
    return out;
  },
  async listTransactions(_itemId, accountId, since) {
    if (accountId.startsWith(INVESTMENT_PREFIX)) return [];
    const key = await apiKey();
    const out: ProviderTx[] = [];
    for (let page = 1; page <= 20; page++) {
      const r = await get<{ results: PTx[]; totalPages: number }>(
        `/transactions?accountId=${encodeURIComponent(accountId)}&from=${since}&pageSize=500&page=${page}`,
        key,
      );
      for (const t of r.results) {
        out.push({ id: t.id, accountId, date: t.date.slice(0, 10), amountCents: pluggyTxCents(t.amount, t.type ?? null), description: t.description, memo: t.descriptionRaw ?? null });
      }
      if (page >= (r.totalPages ?? 1)) break;
    }
    return out;
  },
  parseWebhook(body): WebhookEvent | null {
    const b = (body ?? {}) as Record<string, unknown>;
    const itemId = b["itemId"];
    const ev = b["event"];
    if (typeof itemId !== "string" || typeof ev !== "string") return null;
    if (ev === "item/updated" || ev === "item/created" || ev.startsWith("transactions/")) return { itemId, event: "atualizado" };
    if (ev === "item/error" || ev === "item/login_error") return { itemId, event: "erro" };
    if (ev === "item/deleted") return { itemId, event: "revogado" };
    return null;
  },
};
