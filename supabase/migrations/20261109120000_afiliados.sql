-- Programa de afiliados: inscrição pública, aprovação do admin, indicação por link/código e
-- comissão em centavos a cada pagamento aprovado do indicado. O código não dá desconto, só liga
-- o indicado ao afiliado. Regra de comissão espelhada em src/lib/calc/commission.ts.

-- ---------- Afiliados ----------
create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email text not null unique check (email = lower(btrim(email)) and char_length(email) <= 254 and email like '%_@_%'),
  whatsapp text not null default '' check (char_length(whatsapp) <= 30),
  instagram text not null default '' check (char_length(instagram) <= 100),
  pix_key text not null default '' check (char_length(pix_key) <= 140),
  message text not null default '' check (char_length(message) <= 1000),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'suspenso')),
  code text unique check (code ~ '^[A-Z0-9]{4,20}$'),
  commission_mode text not null default 'meses' check (commission_mode in ('primeiro', 'meses', 'sempre')),
  commission_bp int not null default 2000 check (commission_bp between 0 and 10000), -- 2000 = 20%
  commission_months int check (commission_months between 1 and 120),
  review_note text not null default '' check (char_length(review_note) <= 500),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'aprovado' or code is not null),
  check (commission_mode <> 'meses' or commission_months is not null)
);
create index on public.affiliates (status, created_at desc);

-- ---------- Quem veio por qual afiliado (uma indicação por conta, para sempre) ----------
create table public.referrals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  code text not null,
  source text not null check (source in ('link', 'cupom')),
  created_at timestamptz not null default now()
);
create index on public.referrals (affiliate_id);

-- ---------- Comissões: uma por pagamento ----------
create table public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  referred_user uuid references auth.users(id) on delete set null, -- conta excluída não apaga o que é devido
  payment_id text not null unique,
  payment_cents bigint not null check (payment_cents >= 0),
  commission_cents bigint not null check (commission_cents >= 0),
  status text not null default 'pendente' check (status in ('pendente', 'paga', 'cancelada')),
  paid_at timestamptz,
  paid_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.affiliate_commissions (affiliate_id, status);
create index on public.affiliate_commissions (referred_user);

-- Sem policies: ninguém lê direto; tudo passa pelas funções abaixo (ou pelo service_role).
alter table public.affiliates enable row level security;
alter table public.referrals enable row level security;
alter table public.affiliate_commissions enable row level security;
grant all on public.affiliates, public.referrals, public.affiliate_commissions to service_role;

-- ---------- Ligar a conta conectada a um afiliado ----------
-- p_code nulo usa o código guardado no cadastro (raw_user_meta_data.ref), para quem confirmou o
-- e-mail em outro aparelho. Só vale nos primeiros 7 dias da conta e uma vez.
create or replace function public.claim_referral(p_code text default null, p_source text default 'link')
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  v_user auth.users%rowtype;
  v_code text;
  v_source text := case when p_source = 'cupom' then 'cupom' else 'link' end;
  v_aff public.affiliates%rowtype;
begin
  select * into v_user from auth.users where id = auth.uid();
  if not found then raise exception 'sem sessão' using errcode = '42501'; end if;
  if exists (select 1 from public.referrals where user_id = v_user.id) then
    return jsonb_build_object('ok', false, 'reason', 'ja indicado');
  end if;
  if v_user.created_at < now() - interval '7 days' then
    return jsonb_build_object('ok', false, 'reason', 'conta antiga');
  end if;
  v_code := upper(btrim(coalesce(p_code, v_user.raw_user_meta_data->>'ref', '')));
  if p_code is null and v_user.raw_user_meta_data->>'ref_source' = 'cupom' then v_source := 'cupom'; end if;
  if v_code = '' then return jsonb_build_object('ok', false, 'reason', 'sem codigo'); end if;

  select * into v_aff from public.affiliates where code = v_code and status = 'aprovado';
  if not found then return jsonb_build_object('ok', false, 'reason', 'codigo invalido'); end if;
  if v_aff.email = lower(v_user.email) then
    return jsonb_build_object('ok', false, 'reason', 'proprio codigo');
  end if;

  insert into public.referrals (user_id, affiliate_id, code, source)
  values (v_user.id, v_aff.id, v_code, v_source)
  on conflict (user_id) do nothing;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.claim_referral(text, text) from public, anon;
grant execute on function public.claim_referral(text, text) to authenticated;

-- ---------- Comissão a cada pagamento aprovado ----------
-- credit_payment já é idempotente (um insert por pagamento); o unique em payment_id garante o resto.
create or replace function public._affiliate_commission()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_ref public.referrals%rowtype;
  v_aff public.affiliates%rowtype;
  v_first timestamptz;
begin
  select * into v_ref from public.referrals where user_id = new.user_id;
  if not found or new.created_at < v_ref.created_at then return new; end if;
  select * into v_aff from public.affiliates where id = v_ref.affiliate_id and status = 'aprovado';
  if not found then return new; end if;

  if v_aff.commission_mode = 'primeiro' then
    if exists (select 1 from public.affiliate_commissions where referred_user = new.user_id) then return new; end if;
  elsif v_aff.commission_mode = 'meses' then
    -- Conta a partir do primeiro pagamento depois da indicação (este, se for o primeiro).
    select min(created_at) into v_first from public.payments
     where user_id = new.user_id and status = 'approved' and created_at >= v_ref.created_at;
    if new.created_at >= coalesce(v_first, new.created_at) + make_interval(months => v_aff.commission_months) then
      return new;
    end if;
  end if;

  insert into public.affiliate_commissions (affiliate_id, referred_user, payment_id, payment_cents, commission_cents)
  values (v_aff.id, new.user_id, new.id, new.amount_cents, round(new.amount_cents * v_aff.commission_bp / 10000.0))
  on conflict (payment_id) do nothing;
  return new;
end $$;
revoke execute on function public._affiliate_commission() from public, anon, authenticated;

create trigger payments_affiliate_commission
  after insert on public.payments
  for each row when (new.status = 'approved')
  execute function public._affiliate_commission();

-- ---------- Painel do afiliado (pelo e-mail confirmado da conta) ----------
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
    ), '[]'::jsonb)
  );
end $$;
revoke execute on function public.my_affiliate() from public, anon;
grant execute on function public.my_affiliate() to authenticated;

-- ---------- Admin ----------
create or replace function public.admin_list_affiliates(p_status text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(a) || jsonb_build_object(
      'referrals', (select count(*) from public.referrals r where r.affiliate_id = a.id),
      'pending_cents', (select coalesce(sum(commission_cents), 0) from public.affiliate_commissions c where c.affiliate_id = a.id and c.status = 'pendente'),
      'paid_cents', (select coalesce(sum(commission_cents), 0) from public.affiliate_commissions c where c.affiliate_id = a.id and c.status = 'paga')
    ) order by a.created_at desc)
    from public.affiliates a
    where p_status is null or a.status = p_status
  ), '[]'::jsonb);
end $$;

-- Aprovar (também serve para mudar a regra de quem já está aprovado) ou recusar.
create or replace function public.admin_review_affiliate(
  p_id uuid, p_decision text, p_code text default null, p_mode text default 'meses',
  p_bp int default 2000, p_months int default 12, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  if p_decision = 'aprovar' then
    if exists (select 1 from public.affiliates where code = upper(btrim(p_code)) and id <> p_id) then
      raise exception 'código já usado por outro afiliado';
    end if;
    update public.affiliates set
      status = case when status = 'suspenso' then status else 'aprovado' end,
      code = upper(btrim(p_code)),
      commission_mode = p_mode,
      commission_bp = p_bp,
      commission_months = case when p_mode = 'meses' then p_months end,
      reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id;
  elsif p_decision = 'recusar' then
    update public.affiliates set status = 'recusado', review_note = left(coalesce(p_note, ''), 500),
      reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_id and status = 'pendente';
  else
    raise exception 'decisão inválida';
  end if;
  if not found then raise exception 'afiliado não encontrado'; end if;
  perform public.audit('admin_affiliate_' || p_decision, p_id::text,
    jsonb_build_object('code', p_code, 'mode', p_mode, 'bp', p_bp, 'months', p_months), 'warning');
end $$;

create or replace function public.admin_set_affiliate_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  if p_status not in ('aprovado', 'suspenso') then raise exception 'status inválido'; end if;
  update public.affiliates set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_id and status in ('aprovado', 'suspenso');
  if not found then raise exception 'afiliado não encontrado'; end if;
  perform public.audit('admin_affiliate_status', p_id::text, jsonb_build_object('status', p_status), 'warning');
end $$;

create or replace function public.admin_affiliate_commissions(p_status text)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'affiliate_id', a.id, 'affiliate_name', a.name, 'pix_key', a.pix_key,
      'referred_email', u.email, 'payment_id', c.payment_id, 'payment_cents', c.payment_cents,
      'commission_cents', c.commission_cents, 'status', c.status, 'created_at', c.created_at, 'paid_at', c.paid_at
    ) order by a.name, c.created_at)
    from public.affiliate_commissions c
    join public.affiliates a on a.id = c.affiliate_id
    left join auth.users u on u.id = c.referred_user
    where p_status is null or c.status = p_status
  ), '[]'::jsonb);
end $$;

-- Marca como paga (ou cancela) várias de uma vez; só mexe nas que ainda estão pendentes.
create or replace function public.admin_set_commission_status(p_ids uuid[], p_status text)
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  if p_status not in ('paga', 'cancelada') then raise exception 'status inválido'; end if;
  update public.affiliate_commissions set status = p_status,
    paid_at = case when p_status = 'paga' then now() end,
    paid_by = case when p_status = 'paga' then auth.uid() end
  where id = any(p_ids) and status = 'pendente';
  get diagnostics v_count = row_count;
  perform public.audit('admin_commission_' || p_status, null, jsonb_build_object('ids', to_jsonb(p_ids), 'count', v_count), 'warning');
  return v_count;
end $$;

revoke execute on function public.admin_list_affiliates(text) from public, anon;
revoke execute on function public.admin_review_affiliate(uuid, text, text, text, int, int, text) from public, anon;
revoke execute on function public.admin_set_affiliate_status(uuid, text) from public, anon;
revoke execute on function public.admin_affiliate_commissions(text) from public, anon;
revoke execute on function public.admin_set_commission_status(uuid[], text) from public, anon;
grant execute on function public.admin_list_affiliates(text) to authenticated;
grant execute on function public.admin_review_affiliate(uuid, text, text, text, int, int, text) to authenticated;
grant execute on function public.admin_set_affiliate_status(uuid, text) to authenticated;
grant execute on function public.admin_affiliate_commissions(text) to authenticated;
grant execute on function public.admin_set_commission_status(uuid[], text) to authenticated;
