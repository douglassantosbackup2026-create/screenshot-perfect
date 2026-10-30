import { createFileRoute } from "@tanstack/react-router";
import { periodKey, reminderPush, remindersFor } from "@/lib/push/reminders";
import { spDate } from "@/lib/gamification/rules";

/**
 * Envia os lembretes de hoje por notificação push. Chamada uma vez por dia por um agendador
 * (.github/workflows/lembretes.yml) com Authorization: Bearer <CRON_SECRET>. Pode ser chamada de novo:
 * o reminder_log impede repetir o envio no mesmo mês.
 */
export const Route = createFileRoute("/api/cron/lembretes")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
    },
  },
});

async function run(request: Request) {
  const secret = process.env["CRON_SECRET"];
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("nao autorizado", { status: 401 });
  // Carregados aqui dentro: o cliente com service_role e a chave VAPID nunca vão para o navegador.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendPush, vapidFromEnv } = await import("@/lib/push/send.server");
  const vapid = vapidFromEnv();
  if (!vapid) return Response.json({ ok: false, error: "VAPID não configurado" }, { status: 500 });

  const today = spDate(new Date());
  const { data: recipients, error } = await supabaseAdmin.rpc("push_recipients");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  let sent = 0;
  let skipped = 0;
  let removed = 0;
  for (const r of recipients ?? []) {
    for (const kind of remindersFor(r.reminder_day, today)) {
      // Reserva o envio antes de mandar: se a linha já existe, outro disparo já mandou.
      const { error: dup } = await supabaseAdmin.from("reminder_log").insert({ user_id: r.user_id, kind, period_key: periodKey(kind, today) });
      if (dup) {
        skipped++;
        continue;
      }
      const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", r.user_id);
      for (const sub of subs ?? []) {
        const result = await sendPush(sub, reminderPush(kind, today), vapid);
        if (result === "ok") sent++;
        if (result === "gone") {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          removed++;
        }
      }
    }
  }
  return Response.json({ ok: true, today, recipients: recipients?.length ?? 0, sent, skipped, removed });
}
