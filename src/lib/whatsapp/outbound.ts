// O que o Mitikos responde no WhatsApp, e a tradução para o formato da Cloud API.
// Limites da Meta: até 3 botões (título com 20 caracteres), lista com até 10 linhas (título com 24).

export type Outbound =
  | { kind: "text"; text: string }
  | { kind: "buttons"; text: string; buttons: { id: string; title: string }[] }
  | { kind: "list"; text: string; button: string; rows: { id: string; title: string; description?: string }[] };

const cut = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

/** Corpo da chamada POST /{phone-number-id}/messages. */
export function toGraphPayload(to: string, out: Outbound): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };
  if (out.kind === "text") return { ...base, type: "text", text: { body: cut(out.text, 4096), preview_url: false } };
  if (out.kind === "buttons") {
    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: cut(out.text, 1024) },
        action: { buttons: out.buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: cut(b.id, 256), title: cut(b.title, 20) } })) },
      },
    };
  }
  return {
    ...base,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: cut(out.text, 1024) },
      action: {
        button: cut(out.button, 20),
        sections: [
          {
            title: "Opções",
            rows: out.rows.slice(0, 10).map((r) => ({
              id: cut(r.id, 200),
              title: cut(r.title, 24),
              ...(r.description ? { description: cut(r.description, 72) } : {}),
            })),
          },
        ],
      },
    },
  };
}
