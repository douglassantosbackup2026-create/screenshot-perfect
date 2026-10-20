import { createFileRoute } from "@tanstack/react-router";
import { monthCloseEmail, periodKey, remindersFor, signUser, weeklyMissionEmail, type Recipient } from "@/lib/reminders";
import { MISSIONS } from "@/content/missions";
import { isoWeekKey, spDate, weekStartOf } from "@/lib/gamification/rules";

/**
 * Envia os lembretes de hoje. Chamada uma vez por dia por um agendador (.github/workflows/lembretes.yml)
 * com o cabeçalho Authorization: Bearer <CRON_SECRET>. Pode ser chamada de novo: o reminder_log impede repetir envios.
 */
export const Route = createFileRoute("/api/cron/lembretes")({
  server: {
    handlers: {
      POST: async ({ request }) => run(request),
      GET: async ({ request }) => run(request),
    },
  },
});

async function run(request: Request) {
  const secret = process.env["CRON_SECRET"];
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("nao autorizado", { status: 401 });
  // Carregados aqui dentro: o cliente com service_role e o envio de e-mail nunca vão para o navegador.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendEmail } = await import("@/functions/email");
  const db = supabaseAdmin as unknown as {
    rpc: (fn: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    from: (t: string) => {
      insert: (r: unknown) => PromiseLike<{ error: { code?: string; message: string } | null }>;
      select: (c: string) => PromiseLike<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
    };
  };

  const url = new URL(request.url);
  const site = (process.env["PUBLIC_SITE_URL"] ?? `${url.protocol}//${url.host}`).replace(/\/+$/, "");
  const today = spDate(new Date());
  // Missão da semana pela mesma regra do app (missionOfWeek): segue a ordem pelas missões já concluídas.
  const week = isoWeekKey(weekStartOf(today));
  const { data: done } = await db.from("mission_completions").select("user_id, iso_week");
  const doneBy = new Map<string, { count: number; thisWeek: boolean }>();
  for (const m of done ?? []) {
    const id = String(m["user_id"]);
    const cur = doneBy.get(id) ?? { count: 0, thisWeek: false };
    doneBy.set(id, { count: cur.count + 1, thisWeek: cur.thisWeek || m["iso_week"] === week });
  }

  const { data, error } = await db.rpc("reminder_recipients");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const recipients = ((data ?? []) as Record<string, unknown>[]).map(
    (r): Recipient => ({
      userId: String(r["user_id"]),
      email: String(r["email"]),
      displayName: (r["display_name"] as string) ?? null,
      monthlyReminder: !!r["monthly_reminder"],
      reminderDay: Number(r["reminder_day"]),
      weeklyReminder: !!r["weekly_reminder"],
    }),
  );

  let sent = 0;
  let skipped = 0;
  for (const r of recipients) {
    const progress = doneBy.get(r.userId) ?? { count: 0, thisWeek: false };
    for (const kind of remindersFor(r, today)) {
      // Quem já fez a missão da semana não precisa do lembrete dela.
      if (kind === "missao" && progress.thisWeek) continue;
      // Reserva o envio antes de mandar: se a linha já existe, outro disparo já mandou.
      const { error: dup } = await db.from("reminder_log").insert({ user_id: r.userId, kind, period_key: periodKey(kind, today) });
      if (dup) {
        skipped++;
        continue;
      }
      const unsubscribe = `${site}/api/lembretes/sair?u=${r.userId}&t=${await signUser(r.userId, secret)}`;
      const mission = MISSIONS[progress.count % MISSIONS.length]!;
      const msg = kind === "fechamento" ? monthCloseEmail(r.displayName, today, site, unsubscribe) : weeklyMissionEmail(r.displayName, mission, site, unsubscribe);
      if (await sendEmail(r.email, msg).catch(() => false)) sent++;
    }
  }
  return Response.json({ ok: true, today, recipients: recipients.length, sent, skipped });
}
