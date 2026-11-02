-- Preços dos planos editáveis pelo admin. Vale para quem assinar depois: cada assinatura leva o preço do
-- dia na referência do Mercado Pago (src/lib/billing/catalog.ts) e continua cobrando esse valor.

create table public.plan_prices (
  plan text not null check (plan in ('inteligencia', 'pro')),
  period text not null check (period in ('mensal', 'anual')),
  cents int not null check (cents between 100 and 10000000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  primary key (plan, period)
);
insert into public.plan_prices (plan, period, cents) values
  ('inteligencia', 'mensal', 3990),
  ('inteligencia', 'anual', 39900),
  ('pro', 'mensal', 5990);

-- Preço é público (landing sem login); gravar, só pela função do admin.
alter table public.plan_prices enable row level security;
create policy "precos: todos leem" on public.plan_prices for select to anon, authenticated using (true);
grant select on public.plan_prices to anon, authenticated;
grant all on public.plan_prices to service_role;

create or replace function public.admin_set_plan_price(p_plan text, p_period text, p_cents int)
returns void language plpgsql security definer set search_path = public as $$
declare v_old int;
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  select cents into v_old from public.plan_prices where plan = p_plan and period = p_period;
  if not found then raise exception 'plano não encontrado'; end if;
  update public.plan_prices set cents = p_cents, updated_at = now(), updated_by = auth.uid()
  where plan = p_plan and period = p_period;
  perform public.audit('admin_plan_price', p_plan || ':' || p_period,
    jsonb_build_object('from', v_old, 'to', p_cents), 'warning');
end $$;
revoke execute on function public.admin_set_plan_price(text, text, int) from public, anon;
grant execute on function public.admin_set_plan_price(text, text, int) to authenticated;
