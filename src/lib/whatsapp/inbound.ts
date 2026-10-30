// O que chega no webhook do WhatsApp (Cloud API da Meta), já reduzido ao que o Mitikos usa.
// Payload da Meta: { entry: [{ changes: [{ field: "messages", value: { messages: [...] } }] }] }.
// Status de entrega (statuses) e campos que não usamos são ignorados.
import { z } from "zod";

export type Inbound = {
  /** id da mensagem na Meta (wamid…): evita processar a mesma duas vezes. */
  id: string;
  /** Telefone de quem mandou, só dígitos com DDI (ex.: 5511999990000). */
  from: string;
  at: Date;
} & (
  | { kind: "text"; text: string }
  /** Toque num botão ou numa lista que nós enviamos: `reply` é o id que pusemos no botão. */
  | { kind: "reply"; reply: string }
  | { kind: "media"; mediaId: string; mime: string; caption: string | null }
  | { kind: "other"; type: string }
);

const Message = z.object({
  id: z.string().min(1).max(200),
  from: z.string().regex(/^\d{8,15}$/),
  timestamp: z.string().regex(/^\d+$/),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  interactive: z
    .object({
      type: z.string(),
      button_reply: z.object({ id: z.string() }).optional(),
      list_reply: z.object({ id: z.string() }).optional(),
    })
    .optional(),
  // Botão de resposta rápida de uma mensagem de modelo.
  button: z.object({ payload: z.string() }).optional(),
  image: z.object({ id: z.string(), mime_type: z.string(), caption: z.string().optional() }).optional(),
  document: z.object({ id: z.string(), mime_type: z.string(), caption: z.string().optional() }).optional(),
});

const Payload = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({ messages: z.array(z.unknown()).optional() }).passthrough(),
        }),
      ),
    }),
  ),
});

/** Mensagens válidas do payload. Uma mensagem malformada é descartada sem derrubar as outras. */
export function parseWebhook(body: unknown): Inbound[] {
  const parsed = Payload.safeParse(body);
  if (!parsed.success) return [];
  const out: Inbound[] = [];
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      for (const raw of change.value.messages ?? []) {
        const m = Message.safeParse(raw);
        if (m.success) out.push(toInbound(m.data));
      }
    }
  }
  return out;
}

function toInbound(m: z.infer<typeof Message>): Inbound {
  const base = { id: m.id, from: m.from, at: new Date(Number(m.timestamp) * 1000) };
  if (m.type === "text" && m.text) return { ...base, kind: "text", text: m.text.body.slice(0, 1000) };
  const reply = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? m.button?.payload;
  if (reply) return { ...base, kind: "reply", reply };
  const media = m.image ?? m.document;
  if (media) return { ...base, kind: "media", mediaId: media.id, mime: media.mime_type, caption: media.caption ?? null };
  return { ...base, kind: "other", type: m.type };
}
