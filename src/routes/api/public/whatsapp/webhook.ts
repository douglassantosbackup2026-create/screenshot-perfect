import { createFileRoute } from "@tanstack/react-router";
import { whatsappConfig, sendWhatsApp } from "@/lib/whatsapp/client";
import { parseWebhook } from "@/lib/whatsapp/inbound";
import { verifyMetaSignature } from "@/lib/whatsapp/signature";
import { handleInbound } from "@/lib/whatsapp/handle";

// Webhook do WhatsApp (Cloud API da Meta). GET: verificação do painel da Meta. POST: mensagens.
// Só confia no que vem assinado com o app secret. Responde 200 mesmo quando uma mensagem falha
// (a pessoa recebe um aviso), para a Meta não reenviar em loop; o id de cada mensagem evita lançar duas vezes.
export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const cfg = whatsappConfig();
        if (!cfg) return new Response("not configured", { status: 503 });
        const url = new URL(request.url);
        const ok = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === cfg.verifyToken;
        return ok ? new Response(url.searchParams.get("hub.challenge") ?? "") : new Response("forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const cfg = whatsappConfig();
        if (!cfg) return new Response("not configured", { status: 503 });
        const raw = await request.text();
        if (raw.length > 256 * 1024) return new Response("too large", { status: 413 });
        if (!(await verifyMetaSignature(cfg.appSecret, request.headers.get("x-hub-signature-256"), raw))) {
          return new Response("invalid signature", { status: 401 });
        }
        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("ignored");
        }
        for (const msg of parseWebhook(body)) {
          let reply;
          try {
            reply = await handleInbound(msg);
          } catch (e) {
            console.error("WhatsApp message failed", msg.id, e);
            reply = { kind: "text" as const, text: "Tive um problema para registrar isso agora. Tente de novo em alguns minutos." };
          }
          if (reply) await sendWhatsApp(cfg, msg.from, reply);
        }
        return new Response("ok");
      },
    },
  },
});
