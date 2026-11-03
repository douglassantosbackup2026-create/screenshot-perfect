-- Cadastro pelo painel: acesso de cortesia (plano liberado sem pagamento por alguns meses), com registro de
-- quem deu e por quê. A conta em si é criada pelo servidor (adminCreateUser, service role); aqui ficam a
-- cortesia e as métricas, que não contam cortesia como assinante pagante.

create table public.courtesy_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  months int not null check (months between 1 and 24),
  valid_until timestamptz not null,
  reason text not null default '' check (char_length(reason) <= 200),
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.courtesy_grants (user_id, valid_until desc);
alter table public.courtesy_grants enable row level security;
revoke all on public.courtesy_grants from anon, authenticated;
grant all on public.courtesy_grants to service_role;

-- O acesso vigente vem só de cortesia? (uma cortesia cobre a validade atual inteira)
create or replace function public._is_courtesy(p_user uuid, p_valid_until timestamptz)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.courtesy_grants g where g.user_id = p_user and g.valid_until >= p_valid_until)
$$;
revoke execute on function public._is_courtesy(uuid, timestamptz) from public, anon, authenticated;

create or replace function public.admin_grant_courtesy(p_user uuid, p_months int, p_reason text default '')
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_until timestamptz;
begin
  if not public.staff_has(array['financeiro']) then raise exception 'apenas financeiro' using errcode = '42501'; end if;
  if p_months is null or p_months < 1 or p_months > 24 then raise exception 'cortesia de 1 a 24 meses'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'conta não encontrada'; end if;
  insert into public.entitlements (user_id, plan, valid_until)
  values (p_user, 'inteligencia', now() + make_interval(months => p_months))
  on conflict (user_id) do update set
    valid_until = greatest(public.entitlements.valid_until, now()) + make_interval(months => p_months),
    updated_at = now()
  returning valid_until into v_until;
  insert into public.courtesy_grants (user_id, months, valid_until, reason, granted_by)
  values (p_user, p_months, v_until, left(coalesce(p_reason, ''), 200), auth.uid());
  perform public.audit('admin_courtesy', p_user::text, jsonb_build_object('months', p_months, 'valid_until', v_until, 'reason', p_reason), 'warning');
  return v_until;
end $$;
revoke execute on function public.admin_grant_courtesy(uuid, int, text) from public, anon;
grant execute on function public.admin_grant_courtesy(uuid, int, text) to authenticated;

-- Visão geral e faturamento: assinante ativo é quem paga; cortesia aparece à parte.
do $$
declare
  fn text;
  v_def text;
  v_new text;
  v_old_expr text := '''active_subscribers'', (select count(*) from public.entitlements where valid_until > now()),';
  v_new_expr text := '''courtesy_active'', (select count(*) from public.entitlements e where e.valid_until > now() and public._is_courtesy(e.user_id, e.valid_until)),'
    || chr(10) || '    ''active_subscribers'', (select count(*) from public.entitlements e where e.valid_until > now() and not public._is_courtesy(e.user_id, e.valid_until)),';
begin
  foreach fn in array array['admin_overview', 'admin_billing'] loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = fn;
    v_new := replace(v_def, v_old_expr, v_new_expr);
    if v_new = v_def then raise exception 'contagem de assinantes não encontrada em %', fn; end if;
    execute v_new;
  end loop;
end $$;
