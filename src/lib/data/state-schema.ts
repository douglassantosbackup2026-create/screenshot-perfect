// Conserta o estado salvo antes de usar. Ele vem do banco (jsonb sem validação) ou do localStorage,
// então pode estar incompleto, de uma versão antiga ou adulterado. Campo errado volta ao padrão;
// itens de lista sem o mínimo para as contas são descartados. Nunca lança: o app sempre abre.
import { z } from "zod";
import type { DemoState } from "./demo-store";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isoString = z.string().min(1);
const finite = z.number().finite();

/** O mínimo que cada item precisa para as contas e as telas não quebrarem. */
const ITEM_RULES: Partial<Record<keyof DemoState, z.ZodTypeAny>> = {
  transactions: z.object({ id: isoString, accountId: isoString, date: isoString, amount: finite }).passthrough(),
  contributions: z.object({ id: isoString, month: isoString, made: z.boolean() }).passthrough(),
  wealthEntries: z.object({ id: isoString, month: isoString, total: finite }).passthrough(),
  accounts: z.object({ id: isoString, name: z.string(), kind: isoString }).passthrough(),
  categories: z.object({ id: isoString, name: z.string(), kind: isoString }).passthrough(),
  assets: z.object({ id: isoString, name: z.string(), category: isoString, value: finite }).passthrough(),
  recurring: z.object({ id: isoString, accountId: isoString, amount: finite }).passthrough(),
  holdings: z.object({ id: isoString, assetId: isoString, price: finite }).passthrough(),
  trades: z.object({ holdingId: isoString, quantity: finite }).passthrough(),
  snapshots: z.object({ id: isoString, createdAt: isoString, inputs: z.object({}).passthrough() }).passthrough(),
  xpEvents: z.object({ action: isoString, periodKey: z.string(), xp: finite }).passthrough(),
  goals: z.object({ id: isoString, title: z.string() }).passthrough(),
  days: z.string(),
};

const ARRAY_KEYS = [
  "snapshots",
  "contributions",
  "missionCompletions",
  "xpEvents",
  "weeks",
  "achievements",
  "wealthEntries",
  "goals",
  "challenges",
  "assets",
  "assetValuations",
  "accounts",
  "categories",
  "transactions",
  "recurring",
  "categoryRules",
  "holdings",
  "trades",
  "days",
] as const satisfies readonly (keyof DemoState)[];

const OBJECT_KEYS = ["program", "lessonCompletions", "answers", "budget", "allocationTargets", "journey", "stats"] as const satisfies readonly (keyof DemoState)[];

const planSchema = z
  .object({ id: isoString, createdAt: isoString, updatedAt: isoString, inputs: z.object({}).passthrough() })
  .passthrough()
  .nullable()
  .catch(null);

export type RepairReport = { state: DemoState; dropped: number; reset: string[] };

/**
 * Devolve um estado utilizável a partir de qualquer coisa salva. `fallback` dá os valores padrão
 * (um estado vazio); quem chama ainda passa o resultado pelo `migrate` para preencher campos novos.
 */
export function repairState(raw: unknown, fallback: DemoState): RepairReport {
  const input = isObject(raw) ? raw : {};
  const out: Record<string, unknown> = { ...input };
  const reset: string[] = [];
  let dropped = 0;

  const profile = input["profile"];
  if (!isObject(profile)) reset.push("profile");
  out["profile"] = { ...fallback.profile, ...(isObject(profile) ? profile : {}) };

  for (const key of ARRAY_KEYS) {
    if (!(key in input)) continue; // campo novo: o migrate preenche
    const value = input[key];
    if (!Array.isArray(value)) reset.push(key);
    const items: unknown[] = Array.isArray(value) ? value : [];
    const rule = ITEM_RULES[key];
    const valid = rule ? items.filter((it) => rule.safeParse(it).success) : items;
    dropped += items.length - valid.length;
    out[key] = valid;
  }

  for (const key of OBJECT_KEYS) {
    if (!(key in input)) continue;
    if (!isObject(input[key])) {
      reset.push(key);
      out[key] = fallback[key];
    }
  }

  const plan = planSchema.parse(input["plan"] ?? null);
  if (input["plan"] != null && plan === null) reset.push("plan");
  out["plan"] = plan;

  return { state: out as DemoState, dropped, reset };
}
