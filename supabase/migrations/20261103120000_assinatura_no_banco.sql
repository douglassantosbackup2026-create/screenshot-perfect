-- Sem plano grátis também no banco: com a cobrança ligada, só grava o próprio estado (user_state) quem tem
-- assinatura válida. Ler continua liberado, para exportar os dados. Admin grava sempre.
-- A trava liga por app_settings.billing_enforced, junto com VITE_BILLING_ENABLED no app:
--   update public.app_settings set billing_enforced = true;

create table public.app_settings (
  id boolean primary key default true check (id), -- uma linha só
  billing_enforced boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.app_settings default values;

alter table public.app_settings enable row level security;
-- Ninguém lê nem grava pela API; só as funções abaixo e o service_role.
grant all on public.app_settings to service_role;

create or replace function public.has_active_entitlement()
returns boolean language sql stable security definer set search_path = public as $$
  select not coalesce((select billing_enforced from public.app_settings), false)
    or public.is_admin()
    or exists (select 1 from public.entitlements where user_id = auth.uid() and valid_until > now())
$$;

revoke execute on function public.has_active_entitlement() from public, anon;
grant execute on function public.has_active_entitlement() to authenticated;

drop policy "own state insert" on public.user_state;
drop policy "own state update" on public.user_state;
create policy "own state insert" on public.user_state for insert to authenticated
  with check (auth.uid() = user_id and public.has_active_entitlement());
create policy "own state update" on public.user_state for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id and public.has_active_entitlement());
