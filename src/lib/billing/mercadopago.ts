// Chamadas à API do Mercado Pago, só no servidor (o token vem do ambiente na hora da chamada).
// Toda resposta passa por um esquema zod: dado que não confere vale como falha, nunca como aprovado.
import type { z } from "zod";

const API = "https://api.mercadopago.com";
const TIMEOUT_MS = 10_000;

export const mpToken = () => process.env["MERCADO_PAGO_ACCESS_TOKEN"] || null;

/** Chama a API e valida a resposta. Devolve null em erro de rede, HTTP ou formato (já registrado no log). */
export async function mpRequest<S extends z.ZodTypeAny>(
  token: string,
  path: string,
  schema: S,
  init: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {},
): Promise<z.infer<S> | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`Mercado Pago ${init.method ?? "GET"} ${path} failed [${res.status}]: ${await res.text()}`);
      return null;
    }
    const parsed = schema.safeParse(await res.json());
    if (!parsed.success) {
      console.error(`Mercado Pago ${path}: unexpected response`, parsed.error.issues.slice(0, 3));
      return null;
    }
    return parsed.data;
  } catch (e) {
    console.error(`Mercado Pago ${path} request error`, e);
    return null;
  }
}
