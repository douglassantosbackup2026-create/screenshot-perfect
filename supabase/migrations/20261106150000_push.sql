-- Notificações push (Web Push com VAPID): uma linha por aparelho que aceitou receber.
-- A pessoa liga e desliga no Perfil; o envio é do servidor (/api/cron/lembretes, service_role).

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh text not null check (char_length(p256dh) <= 200),
  auth text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

create policy "push: ler os proprios" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "push: cadastrar o proprio" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy "push: apagar os proprios" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

-- Quem tem aparelho cadastrado, com o dia do lembrete do mês. O dia vem do estado salvo pelo app
-- (user_state.data.profile.reminderDay), que é onde o Perfil grava hoje; sem dia válido, 5.
create or replace function public.push_recipients()
returns table (user_id uuid, reminder_day int)
language sql stable security definer set search_path = public as $$
  select s.user_id,
    case when (st.data->'profile'->>'reminderDay') ~ '^[0-9]{1,2}$'
          and (st.data->'profile'->>'reminderDay')::int between 1 and 28
         then (st.data->'profile'->>'reminderDay')::int else 5 end
  from (select distinct user_id from public.push_subscriptions) s
  left join public.user_state st on st.user_id = s.user_id
$$;

revoke execute on function public.push_recipients() from public, anon, authenticated;
grant execute on function public.push_recipients() to service_role;
