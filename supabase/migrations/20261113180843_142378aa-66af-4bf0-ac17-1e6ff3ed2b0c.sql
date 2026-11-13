create table public.affiliate_managers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email text not null unique check (email = lower(btrim(email)) and email like '%_@_%' and char_length(email) <= 254),
  whatsapp text not null default '' check (char_length(whatsapp) <= 30),
  pix_key text not null default '' check (char_length(pix_key) <= 140),
  commission_bp int not null default 500 check (commission_bp between 0 and 10000),
  code text not null unique check (code ~ '^[A-Z0-9]{4,20}$'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant all on public.affiliate_managers to service_role;
alter table public.affiliate_managers enable row level security;

alter table public.affiliates add column manager_id uuid references public.affiliate_managers(id) on delete set null;
create index on public.affiliates (manager_id);

create table public.manager_commissions (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references public.affiliate_managers(id) on delete cascade,
  affiliate_id uuid references public.affiliates(id) on delete set null,
  referred_user uuid references auth.users(id) on delete set null,
  payment_id text not null unique,
  payment_cents bigint not null check (payment_cents >= 0),
  commission_cents bigint not null check (commission_cents >= 0),
  status text not null default 'pendente' check (status in ('pendente', 'paga', 'cancelada')),
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.manager_commissions (manager_id, status);
grant all on public.manager_commissions to service_role;
alter table public.manager_commissions enable row level security;

-- Comissão do gerente: mesma regra de prazo do parceiro, % própria do gerente.
create or replace function public._affiliate_commission()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ref public.referrals%rowtype;
  v_aff public.affiliates%rowtype;
  v_mgr public.affiliate_managers%rowtype;
  v_first timestamptz;
begin
  select * into v_ref from public.referrals where user_id = new.user_id;
  if not found or new.created_at < v_ref.created_at then return new; end if;
  select * into v_aff from public.affiliates where id = v_ref.affiliate_id and status = 'aprovado';
  if not found then return new; end if;

  if v_aff.commission_mode = 'primeiro' then
    if exists (select 1 from public.affiliate_commissions where referred_user = new.user_id) then return new; end if;
  elsif v_aff.commission_mode = 'meses' then
    select min(created_at) into v_first from public.payments
     where user_id = new.user_id and status = 'approved' and created_at >= v_ref.created_at;
    if new.created_at >= coalesce(v_first, new.created_at) + make_interval(months => v_aff.commission_months) then
      return new;
    end if;
  end if;

  insert into public.affiliate_commissions (affiliate_id, referred_user, payment_id, payment_cents, commission_cents)
  values (v_aff.id, new.user_id, new.id, new.amount_cents, round(new.amount_cents * v_aff.commission_bp / 10000.0))
  on conflict (payment_id) do nothing;

  if v_aff.manager_id is not null then
    select * into v_mgr from public.affiliate_managers where id = v_aff.manager_id and active;
    if found then
      insert into public.manager_commissions (manager_id, affiliate_id, referred_user, payment_id, payment_cents, commission_cents)
      values (v_mgr.id, v_aff.id, new.user_id, new.id, new.amount_cents, round(new.amount_cents * v_mgr.commission_bp / 10000.0))
      on conflict (payment_id) do nothing;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public._affiliate_commission() from public, anon, authenticated;

-- ---------- Admin ----------
create or replace function public.admin_list_managers()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.staff_has(array['financeiro', 'marketing']) then raise exception 'apenas admin' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(m) || jsonb_build_object(
      'partners', (select count(*) from public.affiliates a where a.manager_id = m.id),
      'pending_cents', (select coalesce(sum(commission_cents), 0) from public.manager_commissions c where c.manager_id = m.id and c.status = 'pendente'),
      'paid_cents', (select coalesce(sum(commission_cents), 0) from public.manager_commissions c where c.manager_id = m.id and c.status = 'paga')
    ) order by m.name)
    from public.affiliate_managers m
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_save_manager(p_id uuid, p_manager jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.staff_has(array['financeiro', 'marketing']) then raise exception 'apenas admin' using errcode = '42501'; end if;
  if p_id is null then
    insert into public.affiliate_managers (name, email, whatsapp, pix_key, commission_bp, code, active)
    values (btrim(p_manager->>'name'), lower(btrim(p_manager->>'email')), coalesce(p_manager->>'whatsapp', ''),
            coalesce(p_manager->>'pix_key', ''), (p_manager->>'commission_bp')::int, upper(btrim(p_manager->>'code')),
            coalesce((p_manager->>'active')::boolean, true))
    returning id into v_id;
  else
    update public.affiliate_managers set name = btrim(p_manager->>'name'), email = lower(btrim(p_manager->>'email')),
      whatsapp = coalesce(p_manager->>'whatsapp', ''), pix_key = coalesce(p_manager->>'pix_key', ''),
      commission_bp = (p_manager->>'commission_bp')::int, code = upper(btrim(p_manager->>'code')),
      active = coalesce((p_manager->>'active')::boolean, true)
    where id = p_id returning id into v_id;
  end if;
  perform public.audit('admin_manager_save', v_id::text, p_manager, 'info');
  return v_id;
end $$;

create or replace function public.admin_set_affiliate_manager(p_affiliate uuid, p_manager uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.staff_has(array['financeiro', 'marketing']) then raise exception 'apenas admin' using errcode = '42501'; end if;
  update public.affiliates set manager_id = p_manager where id = p_affiliate;
  perform public.audit('admin_affiliate_manager', p_affiliate::text, jsonb_build_object('manager', p_manager), 'info');
end $$;

create or replace function public.admin_affiliate_commissions(p_status text)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.staff_has(array['financeiro', 'marketing']) then raise exception 'apenas admin' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'affiliate_name', x->>'created_at') from (
      select jsonb_build_object(
        'id', c.id, 'kind', 'parceiro', 'affiliate_id', a.id, 'affiliate_name', a.name, 'pix_key', a.pix_key,
        'referred_email', u.email, 'payment_id', c.payment_id, 'payment_cents', c.payment_cents,
        'commission_cents', c.commission_cents, 'status', c.status, 'created_at', c.created_at, 'paid_at', c.paid_at) x
      from public.affiliate_commissions c
      join public.affiliates a on a.id = c.affiliate_id
      left join auth.users u on u.id = c.referred_user
      where p_status is null or c.status = p_status
      union all
      select jsonb_build_object(
        'id', c.id, 'kind', 'gerente', 'affiliate_id', m.id, 'affiliate_name', m.name, 'pix_key', m.pix_key,
        'referred_email', u.email, 'payment_id', c.payment_id, 'payment_cents', c.payment_cents,
        'commission_cents', c.commission_cents, 'status', c.status, 'created_at', c.created_at, 'paid_at', c.paid_at)
      from public.manager_commissions c
      join public.affiliate_managers m on m.id = c.manager_id
      left join auth.users u on u.id = c.referred_user
      where p_status is null or c.status = p_status
    ) s
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_set_commission_status(p_ids uuid[], p_status text)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count int; v_more int;
begin
  if not public.staff_has(array['financeiro']) then raise exception 'apenas admin' using errcode = '42501'; end if;
  if p_status not in ('paga', 'cancelada') then raise exception 'status inválido'; end if;
  update public.affiliate_commissions set status = p_status,
    paid_at = case when p_status = 'paga' then now() end,
    paid_by = case when p_status = 'paga' then auth.uid() end
  where id = any(p_ids) and status = 'pendente';
  get diagnostics v_count = row_count;
  update public.manager_commissions set status = p_status,
    paid_at = case when p_status = 'paga' then now() end,
    paid_by = case when p_status = 'paga' then auth.uid() end
  where id = any(p_ids) and status = 'pendente';
  get diagnostics v_more = row_count;
  v_count := v_count + v_more;
  perform public.audit('admin_commission_' || p_status, null, jsonb_build_object('ids', to_jsonb(p_ids), 'count', v_count), 'warning');
  return v_count;
end $$;

-- ---------- Área do gerente (pelo e-mail confirmado) ----------
create or replace function public.my_manager()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare v_email text; v_m public.affiliate_managers%rowtype;
begin
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return null; end if;
  select * into v_m from public.affiliate_managers where email = v_email and active;
  if not found then return null; end if;
  return jsonb_build_object(
    'name', v_m.name, 'code', v_m.code, 'commission_bp', v_m.commission_bp,
    'pending_cents', (select coalesce(sum(commission_cents), 0) from public.manager_commissions where manager_id = v_m.id and status = 'pendente'),
    'paid_cents', (select coalesce(sum(commission_cents), 0) from public.manager_commissions where manager_id = v_m.id and status = 'paga'),
    'partners', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'name', a.name, 'status', a.status, 'code', a.code,
        'referrals', (select count(*) from public.referrals r where r.affiliate_id = a.id),
        'sales_cents', (select coalesce(sum(payment_cents), 0) from public.affiliate_commissions c where c.affiliate_id = a.id and c.status <> 'cancelada'),
        'partner_cents', (select coalesce(sum(commission_cents), 0) from public.affiliate_commissions c where c.affiliate_id = a.id and c.status <> 'cancelada'),
        'manager_cents', (select coalesce(sum(commission_cents), 0) from public.manager_commissions c where c.affiliate_id = a.id and c.manager_id = v_m.id and c.status <> 'cancelada')
      ) order by a.name) from public.affiliates a where a.manager_id = v_m.id), '[]'::jsonb)
  );
end $$;

revoke execute on function public.admin_list_managers(), public.admin_save_manager(uuid, jsonb),
  public.admin_set_affiliate_manager(uuid, uuid), public.my_manager() from public, anon;
grant execute on function public.admin_list_managers(), public.admin_save_manager(uuid, jsonb),
  public.admin_set_affiliate_manager(uuid, uuid), public.my_manager() to authenticated;