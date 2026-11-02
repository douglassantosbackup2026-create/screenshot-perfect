import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { allow, clientIp } from "@/lib/security/rate-limit.server";
import { readLimitedText } from "@/lib/security/body";

// Recebe erros do navegador (src/lib/client-errors.ts) e só registra no log do servidor.
// Não grava nada nem responde dados: o pior que um abuso faz é encher o log, e o corpo tem tamanho limitado
// e cada IP manda no máximo 30 relatos por minuto.
const MAX_BODY = 8 * 1024;
const Report = z.object({
  kind: z.enum(["boundary", "root", "onerror", "unhandledrejection"]),
  message: z.string().max(500),
  stack: z.string().max(4000),
  path: z.string().max(200),
});

export const Route = createFileRoute("/api/public/client-error")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const text = await readLimitedText(request, MAX_BODY);
        if (!text) return new Response(null, { status: 204 });
        if (!(await allow([{ key: `client-error:ip:${clientIp(request)}`, limit: 30, windowSeconds: 60 }]))) return new Response(null, { status: 204 });
        try {
          const r = Report.parse(JSON.parse(text));
          console.error(`[client-error] ${r.kind} ${r.path}: ${r.message}\n${r.stack}`);
        } catch {
          /* relato malformado: ignora */
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
