import { createFileRoute } from "@tanstack/react-router";
import { verifyUser } from "@/lib/reminders";

const page = (title: string, text: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#0c0c0b;color:#f0efec;font-family:Arial,sans-serif"><main style="max-width:480px;margin:0 auto;padding:48px 24px">
<p style="color:#f6c800;font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase">Previdência Intelligence</p>
<h1 style="font-size:24px">${title}</h1><p style="color:#c3c2b7;line-height:1.6">${text}</p>
<p><a href="/perfil" style="color:#f6c800">Abrir o app</a></p></main></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

/** Link "não quero mais receber" dos e-mails: desliga os lembretes sem precisar entrar (o link é assinado). */
export const Route = createFileRoute("/api/lembretes/sair")({
  server: {
    handlers: {
      GET: async ({ request }) => unsubscribe(request),
      // Clientes de e-mail que fazem "um clique" mandam POST no mesmo endereço.
      POST: async ({ request }) => unsubscribe(request),
    },
  },
});

async function unsubscribe(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const secret = process.env["CRON_SECRET"];
  if (!secret || !/^[0-9a-f-]{36}$/.test(userId) || !(await verifyUser(userId, token, secret)))
    return page("Link inválido", "Este link não é válido. Você pode desligar os lembretes no Perfil do app.", 400);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as {
    from: (t: string) => { update: (p: unknown) => { eq: (c: string, v: string) => PromiseLike<{ error: { message: string } | null }> } };
  };
  const { error } = await db.from("profiles").update({ monthly_reminder: false, weekly_reminder: false }).eq("id", userId);
  if (error) return page("Não deu certo", "Não conseguimos desligar agora. Tente de novo em instantes ou desligue no Perfil do app.", 500);
  return page("Lembretes desligados", "Você não vai mais receber lembretes por e-mail. Se mudar de ideia, ligue de novo no Perfil.");
}
