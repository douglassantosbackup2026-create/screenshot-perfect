import { createFileRoute } from "@tanstack/react-router";
import { allow, clientIp } from "@/lib/security/rate-limit.server";

// Relatórios de violação da CSP (report-uri em src/lib/security-headers.ts). Só registra no log do servidor:
// é o que mostra se a CSP completa já pode ser imposta. Corpo limitado e no máximo 20 relatos por minuto por IP.
const MAX_BODY = 8 * 1024;

export const Route = createFileRoute("/api/public/csp-report")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const text = await request.text().catch(() => "");
        if (!text || text.length > MAX_BODY) return new Response(null, { status: 204 });
        if (!(await allow([{ key: `csp:ip:${clientIp(request)}`, limit: 20, windowSeconds: 60 }]))) return new Response(null, { status: 204 });
        try {
          const body = JSON.parse(text) as { "csp-report"?: Record<string, unknown> };
          const r = body["csp-report"] ?? {};
          const pick = (k: string) => String(r[k] ?? "").slice(0, 300);
          console.warn(`[csp] ${pick("violated-directive")} blocked=${pick("blocked-uri")} page=${pick("document-uri")}`);
        } catch {
          /* relato malformado: ignora */
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
