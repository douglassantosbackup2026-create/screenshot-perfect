-- Investimentos: posições dentro dos itens do Patrimônio, operações (compra, venda, provento) e metas de alocação.
-- Espelha src/lib/calc/portfolio.ts e as operações de investimentos de src/lib/data/demo-store.ts.
-- Dinheiro em centavos (bigint); quantidades com fração (numeric). Não gera XP.
-- Preço médio, ganhos, alocação e XIRR são calculados no cliente a partir das operações.
-- Com operações lançadas, o valor do item passa a ser o das posições: o cliente calcula (holdingsValue)
-- e grava com set_asset_value_from_holdings, que também guarda o histórico do item.

create type public.asset_class as enum ('previdencia', 'renda_fixa', 'acoes', 'fiis', 'exterior', 'cripto', 'outros');
create type public.trade_type as enum ('compra', 'venda', 'provento');

create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  asset_class public.asset_class not null,
  price bigint not null default 0 check (price >= 0),
  price_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.holdings(user_id);
create index on public.holdings(asset_id);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  holding_id uuid not null references public.holdings(id) on delete cascade,
  date date not null,
  type public.trade_type not null,
  quantity numeric(24,8) not null default 0 check (quantity >= 0),
  -- Compra/venda: centavos por unidade. Provento: total recebido.
  unit_price bigint not null check (unit_price > 0),
  fees bigint not null default 0 check (fees >= 0),
  created_at timestamptz not null default now(),
  check ((type = 'provento' and quantity = 0) or (type <> 'provento' and quantity > 0))
);
create index on public.trades(holding_id, date);

create table public.allocation_targets (
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_class public.asset_class not null,
  percent numeric(5,2) not null check (percent > 0 and percent <= 100),
  primary key (user_id, asset_class)
);

do $$
declare t text;
begin
  foreach t in array array['holdings', 'trades'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: ler os proprios" on public.%I for select to authenticated using (user_id = auth.uid())', t, t);
    execute format('create policy "%s: criar os proprios" on public.%I for insert to authenticated with check (user_id = auth.uid())', t, t);
    execute format('create policy "%s: editar os proprios" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('create policy "%s: excluir os proprios" on public.%I for delete to authenticated using (user_id = auth.uid())', t, t);
  end loop;
end $$;
alter table public.allocation_targets enable row level security;
create policy "metas de alocacao: ler as proprias" on public.allocation_targets for select to authenticated using (user_id = auth.uid());
-- Gravação apenas por set_allocation_targets (precisam somar 100%).

-- Posição só em item de investimento ou previdência da própria pessoa; operação só em posição própria, até hoje.
create or replace function public._portfolio_check_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'holdings' then
    if not exists (select 1 from public.assets where id = new.asset_id and user_id = new.user_id
                   and category in ('investimentos', 'pgbl', 'vgbl', 'outro')) then
      raise exception 'posicoes so em itens de investimento ou previdencia';
    end if;
    if tg_op = 'UPDATE' and new.price is distinct from old.price then new.price_updated_at := now(); end if;
  else
    if not exists (select 1 from public.holdings where id = new.holding_id and user_id = new.user_id) then
      raise exception 'posicao nao encontrada';
    end if;
    if new.date > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'data futura'; end if;
  end if;
  return new;
end $$;
create trigger holdings_owner before insert or update on public.holdings
  for each row execute function public._portfolio_check_owner();
create trigger trades_owner before insert or update on public.trades
  for each row execute function public._portfolio_check_owner();

-- A venda não pode passar da quantidade em carteira na data (compras do dia vêm antes das vendas).
create or replace function public._trades_check_quantity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_holding uuid := coalesce(new.holding_id, old.holding_id);
  v_bad boolean;
begin
  select bool_or(running < -1e-8) into v_bad from (
    select sum(case type when 'compra' then quantity when 'venda' then -quantity else 0 end)
             over (order by date, case type when 'compra' then 0 when 'provento' then 1 else 2 end, created_at) as running
    from public.trades where holding_id = v_holding
  ) q;
  if coalesce(v_bad, false) then raise exception 'venda acima da quantidade em carteira'; end if;
  return null;
end $$;
create constraint trigger trades_quantity after insert or update or delete on public.trades
  deferrable initially deferred for each row execute function public._trades_check_quantity();

-- Mudar a categoria de um item com posições para algo que não comporta posições é recusado.
create or replace function public._assets_keep_holdings()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.category not in ('investimentos', 'pgbl', 'vgbl', 'outro') and exists (select 1 from public.holdings where asset_id = new.id) then
    raise exception 'remova as posicoes antes de mudar a categoria';
  end if;
  return new;
end $$;
create trigger assets_keep_holdings before update of category on public.assets
  for each row execute function public._assets_keep_holdings();

-- Metas por classe, somando 100%. Vazio apaga as metas (espelho de setAllocationTargets).
create or replace function public.set_allocation_targets(p_targets jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_sum numeric;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  select coalesce(sum((value)::numeric), 0) into v_sum from jsonb_each_text(p_targets) where (value)::numeric > 0;
  if v_sum <> 0 and abs(v_sum - 100) > 0.01 then raise exception 'as metas precisam somar 100'; end if;
  delete from public.allocation_targets where user_id = v_user;
  insert into public.allocation_targets (user_id, asset_class, percent)
    select v_user, key::public.asset_class, value::numeric from jsonb_each_text(p_targets) where value::numeric > 0;
end $$;

-- Valor do item a partir das posições, com histórico (espelho de syncAssetFromHoldings).
create or replace function public.set_asset_value_from_holdings(p_asset uuid, p_value numeric)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_month date := date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if p_value is null or p_value < 0 then raise exception 'valor invalido'; end if;
  if not exists (select 1 from public.trades t join public.holdings h on h.id = t.holding_id
                 where h.asset_id = p_asset and h.user_id = v_user) then
    raise exception 'item sem operacoes de investimento';
  end if;
  update public.assets set value = p_value, updated_at = now()
    where id = p_asset and user_id = v_user and value is distinct from p_value;
  if found then
    insert into public.asset_valuations (user_id, asset_id, month, value)
    values (v_user, p_asset, v_month, p_value)
    on conflict (asset_id, month) do update set value = excluded.value, created_at = now();
  end if;
end $$;

-- ---------- Exportação inclui os investimentos ----------
create or replace function public.export_my_data()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'plans', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.retirement_plans r where r.user_id = auth.uid()),
    'plan_history', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.plan_snapshots s where s.user_id = auth.uid()),
    'contributions', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.contributions c where c.user_id = auth.uid()),
    'wealth', (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) from public.wealth_entries w where w.user_id = auth.uid()),
    'assets', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.assets a where a.user_id = auth.uid()),
    'asset_valuations', (select coalesce(jsonb_agg(to_jsonb(v)), '[]'::jsonb) from public.asset_valuations v where v.user_id = auth.uid()),
    'holdings', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.holdings x where x.user_id = auth.uid()),
    'trades', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.trades x where x.user_id = auth.uid()),
    'allocation_targets', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.allocation_targets x where x.user_id = auth.uid()),
    'accounts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.accounts x where x.user_id = auth.uid()),
    'categories', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.categories x where x.user_id = auth.uid()),
    'transactions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.transactions x where x.user_id = auth.uid()),
    'recurring_rules', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.recurring_rules x where x.user_id = auth.uid()),
    'category_rules', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.category_rules x where x.user_id = auth.uid()),
    'budget_assignments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.budget_assignments x where x.user_id = auth.uid()),
    'budget_templates', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.budget_templates x where x.user_id = auth.uid()),
    'goals', (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from public.goals g where g.user_id = auth.uid()),
    'challenges', (select coalesce(jsonb_agg(to_jsonb(uc)), '[]'::jsonb) from public.user_challenges uc where uc.user_id = auth.uid()),
    'lessons_completed', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from public.lesson_completions l where l.user_id = auth.uid()),
    'answers', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.question_answers a where a.user_id = auth.uid()),
    'missions', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.mission_completions m where m.user_id = auth.uid()),
    'xp', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.xp_events x where x.user_id = auth.uid()),
    'achievements', (select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) from public.user_achievements u where u.user_id = auth.uid())
  )
$$;

-- ---------- Permissões ----------
grant select, insert, update, delete on public.holdings, public.trades to authenticated;
grant select on public.allocation_targets to authenticated;
grant all on public.holdings, public.trades, public.allocation_targets to service_role;
revoke execute on function public.set_allocation_targets(jsonb), public.set_asset_value_from_holdings(uuid, numeric) from public, anon;
revoke execute on function public._portfolio_check_owner(), public._trades_check_quantity(), public._assets_keep_holdings() from public, anon, authenticated;
grant execute on function public.set_allocation_targets(jsonb), public.set_asset_value_from_holdings(uuid, numeric) to authenticated;
