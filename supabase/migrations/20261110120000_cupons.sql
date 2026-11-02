-- Cupons de desconto na assinatura, criados pelo admin e, se quiser, ligados a um afiliado.
-- O desconto vale na 1ª cobrança, nas N primeiras ou sempre; depois o webhook volta a assinatura do
-- Mercado Pago ao preço cheio. Regra espelhada em src/lib/calc/coupon.ts.

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{3,20}$'),
  kind text not null check (kind in ('percent', 'fixed')),
  value int not null check (value > 0),          -- percent: basis points (2000 = 20%); fixed: centavos
  duration text not null check (duration in ('primeira', 'meses', 'sempre')),
  cycles int check (cycles between 1 and 120),   -- só em "meses"
  periods text[] not null default array['mensal', 'anual'] check (periods <@ array['mensal', 'anual'] and cardinality(periods) > 0),
  max_uses int check (max_uses > 0),             -- null = sem limite
  expires_at timestamptz,                        -- null = não vence
  active boolean not null default true,
  affiliate_id uuid references public.affiliates(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 10000),
  check (duration <> 'meses' or cycles is not null)
);
create index on public.coupons (affiliate_id);

-- Um uso por pessoa, contado no primeiro pagamento com desconto (abrir o checkout não conta).
create table public.coupon_redemptions (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (coupon_id, user_id)
);

alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
grant all on public.coupons, public.coupon_redemptions to service_role;

-- O que a assinatura cobra hoje e até quando vale o desconto. amount_cents nulo = preço cheio.
alter table public.subscriptions
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null,
  add column if not exists amount_cents bigint,
  add column if not exists full_cents bigint,
  add column if not exists coupon_cycles int,
  add column if not exists cycles_used int not null default 0;

-- ---------- Cada pagamento com desconto conta um ciclo e registra o uso ----------
create or replace function public._coupon_cycle()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sub public.subscriptions%rowtype;
begin
  select * into v_sub from public.subscriptions where user_id = new.user_id;
  if not found or v_sub.coupon_id is null or v_sub.amount_cents is null or v_sub.amount_cents >= v_sub.full_cents
     or new.amount_cents <> v_sub.amount_cents then
    return new;
  end if;
  update public.subscriptions set cycles_used = cycles_used + 1 where user_id = new.user_id;
  insert into public.coupon_redemptions (coupon_id, user_id) values (v_sub.coupon_id, new.user_id)
  on conflict do nothing;
  return new;
end $$;
revoke execute on function public._coupon_cycle() from public, anon, authenticated;

create trigger payments_coupon_cycle
  after insert on public.payments
  for each row when (new.status = 'approved')
  execute function public._coupon_cycle();

-- ---------- Admin ----------
create or replace function public.admin_list_coupons()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(c) || jsonb_build_object(
      'uses', (select count(*) from public.coupon_redemptions r where r.coupon_id = c.id),
      'affiliate_name', (select a.name from public.affiliates a where a.id = c.affiliate_id)
    ) order by c.active desc, c.created_at desc)
    from public.coupons c
  ), '[]'::jsonb);
end $$;

-- Cria (p_id nulo) ou edita. Mudar o desconto vale para quem assinar depois; assinaturas abertas não mudam.
create or replace function public.admin_save_coupon(p_id uuid, p_coupon jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_code text := upper(btrim(p_coupon->>'code'));
  v_duration text := p_coupon->>'duration';
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  if exists (select 1 from public.coupons where code = v_code and id is distinct from p_id) then
    raise exception 'já existe um cupom com este código';
  end if;
  if p_id is null then
    insert into public.coupons (code, kind, value, duration, cycles, periods, max_uses, expires_at, active, affiliate_id, created_by)
    values (
      v_code, p_coupon->>'kind', (p_coupon->>'value')::int, v_duration,
      case when v_duration = 'meses' then (p_coupon->>'cycles')::int end,
      array(select jsonb_array_elements_text(p_coupon->'periods')),
      nullif(p_coupon->>'max_uses', '')::int, nullif(p_coupon->>'expires_at', '')::timestamptz,
      coalesce((p_coupon->>'active')::boolean, true), nullif(p_coupon->>'affiliate_id', '')::uuid, auth.uid())
    returning id into v_id;
  else
    update public.coupons set
      code = v_code, kind = p_coupon->>'kind', value = (p_coupon->>'value')::int, duration = v_duration,
      cycles = case when v_duration = 'meses' then (p_coupon->>'cycles')::int end,
      periods = array(select jsonb_array_elements_text(p_coupon->'periods')),
      max_uses = nullif(p_coupon->>'max_uses', '')::int, expires_at = nullif(p_coupon->>'expires_at', '')::timestamptz,
      active = coalesce((p_coupon->>'active')::boolean, active), affiliate_id = nullif(p_coupon->>'affiliate_id', '')::uuid
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'cupom não encontrado'; end if;
  end if;
  perform public.audit('admin_coupon_saved', v_id::text, p_coupon, 'warning');
  return v_id;
end $$;

create or replace function public.admin_set_coupon_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  update public.coupons set active = p_active where id = p_id;
  if not found then raise exception 'cupom não encontrado'; end if;
  perform public.audit('admin_coupon_active', p_id::text, jsonb_build_object('active', p_active), 'warning');
end $$;

revoke execute on function public.admin_list_coupons() from public, anon;
revoke execute on function public.admin_save_coupon(uuid, jsonb) from public, anon;
revoke execute on function public.admin_set_coupon_active(uuid, boolean) from public, anon;
grant execute on function public.admin_list_coupons() to authenticated;
grant execute on function public.admin_save_coupon(uuid, jsonb) to authenticated;
grant execute on function public.admin_set_coupon_active(uuid, boolean) to authenticated;

-- ---------- Painel do afiliado: agora com os cupons dele ----------
create or replace function public.my_affiliate()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_email text;
  v_aff public.affiliates%rowtype;
begin
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then return null; end if;
  select * into v_aff from public.affiliates where email = v_email;
  if not found then return null; end if;
  return jsonb_build_object(
    'status', v_aff.status,
    'name', v_aff.name,
    'code', v_aff.code,
    'commission_mode', v_aff.commission_mode,
    'commission_bp', v_aff.commission_bp,
    'commission_months', v_aff.commission_months,
    'review_note', case when v_aff.status = 'recusado' then v_aff.review_note else '' end,
    'referrals', (select count(*) from public.referrals where affiliate_id = v_aff.id),
    'pending_cents', (select coalesce(sum(commission_cents), 0) from public.affiliate_commissions where affiliate_id = v_aff.id and status = 'pendente'),
    'paid_cents', (select coalesce(sum(commission_cents), 0) from public.affiliate_commissions where affiliate_id = v_aff.id and status = 'paga'),
    'commissions', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'payment_cents', c.payment_cents, 'commission_cents', c.commission_cents,
                                          'status', c.status, 'created_at', c.created_at, 'paid_at', c.paid_at) order by c.created_at desc)
        from (select * from public.affiliate_commissions where affiliate_id = v_aff.id order by created_at desc limit 30) c
    ), '[]'::jsonb),
    'coupons', case when v_aff.status <> 'aprovado' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('code', k.code, 'kind', k.kind, 'value', k.value, 'duration', k.duration,
                                          'cycles', k.cycles, 'expires_at', k.expires_at) order by k.created_at desc)
        from public.coupons k
       where k.affiliate_id = v_aff.id and k.active and (k.expires_at is null or k.expires_at > now())
    ), '[]'::jsonb) end
  );
end $$;
