-- Planos pagos: o plano em vigor de cada pessoa e os pagamentos já creditados (para nunca creditar duas vezes).
-- Espelha src/lib/billing.ts, src/functions/billing.ts e a rota /api/pagamentos/webhook.
-- Só o servidor (service_role) grava; a pessoa só lê o próprio plano.

create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('inteligencia', 'pro')),
  valid_until timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;

create policy "plano: ler o proprio" on public.entitlements for select to authenticated using (user_id = auth.uid());

create table public.payments (
  id text primary key, -- id do pagamento no Mercado Pago
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('inteligencia', 'pro')),
  period text not null check (period in ('mensal', 'anual')),
  amount_cents bigint not null check (amount_cents > 0),
  status text not null,
  created_at timestamptz not null default now()
);

create index on public.payments(user_id);

alter table public.payments enable row level security;

create policy "pagamentos: ler os proprios" on public.payments for select to authenticated using (user_id = auth.uid());

-- Credita um pagamento aprovado: registra o pagamento (uma vez) e estende a validade a partir do vencimento atual.
create or replace function public.credit_payment(p_id text, p_user uuid, p_plan text, p_period text, p_amount_cents bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_days int := case p_period when 'anual' then 366 else 31 end;
  v_until timestamptz;
begin
  insert into public.payments (id, user_id, plan, period, amount_cents, status)
  values (p_id, p_user, p_plan, p_period, p_amount_cents, 'approved')
  on conflict (id) do nothing;
  if not found then
    return jsonb_build_object('credited', false, 'reason', 'ja creditado');
  end if;
  insert into public.entitlements (user_id, plan, valid_until)
  values (p_user, p_plan, now() + make_interval(days => v_days))
  on conflict (user_id) do update set
    -- Pro vence Inteligência; a validade soma a partir do vencimento se ainda estiver valendo.
    plan = case when excluded.plan = 'pro' or public.entitlements.valid_until < now() then excluded.plan else public.entitlements.plan end,
    valid_until = greatest(public.entitlements.valid_until, now()) + make_interval(days => v_days),
    updated_at = now()
  returning valid_until into v_until;
  return jsonb_build_object('credited', true, 'valid_until', v_until);
end $$;

grant select on public.entitlements, public.payments to authenticated;
grant all on public.entitlements, public.payments to service_role;
revoke execute on function public.credit_payment(text, uuid, text, text, bigint) from public, anon, authenticated;
grant execute on function public.credit_payment(text, uuid, text, text, bigint) to service_role;
