-- Lembretes por e-mail: quem recebe e o registro do que já foi enviado (para nunca repetir).
-- Espelha src/lib/reminders.ts e a rota /api/cron/lembretes. Só o servidor (service_role) acessa.

create table public.reminder_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('fechamento', 'missao')),
  period_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, period_key)
);
alter table public.reminder_log enable row level security;
-- Sem policies: ninguém pelo app lê ou grava; só o service_role.

-- Pessoas com algum lembrete ligado e e-mail confirmado.
create or replace function public.reminder_recipients()
returns table (user_id uuid, email text, display_name text, monthly_reminder boolean, reminder_day int, weekly_reminder boolean)
language sql stable security definer set search_path = public, auth as $$
  select p.id, u.email::text, p.display_name, p.monthly_reminder, p.reminder_day, p.weekly_reminder
  from public.profiles p
  join auth.users u on u.id = p.id
  where (p.monthly_reminder or p.weekly_reminder)
    and u.email is not null
    and u.email_confirmed_at is not null
    and p.onboarding_completed_at is not null
$$;

grant all on public.reminder_log to service_role;
revoke execute on function public.reminder_recipients() from public, anon, authenticated;
grant execute on function public.reminder_recipients() to service_role;
