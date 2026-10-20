-- Histórico do patrimônio: valor de cada item mês a mês e registro mensal montado a partir dos itens.
-- Espelha src/lib/calc/networth.ts e src/lib/data/demo-store.ts (saveAsset, logWealthFromAssets).
-- Como antes, cadastrar itens não gera XP; só o registro mensal do patrimônio gera.

-- ---------- Valor de cada item por mês ----------
create table public.asset_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  value numeric(14,2) not null check (value >= 0),
  created_at timestamptz not null default now(),
  unique (asset_id, month)
);
create index on public.asset_valuations(user_id);
alter table public.asset_valuations enable row level security;
create policy "historico de ativos: ler o proprio" on public.asset_valuations
  for select to authenticated using (user_id = auth.uid());
-- Gravação apenas por upsert_asset

-- Itens que já existiam ganham o primeiro ponto do histórico, no mês da última atualização.
insert into public.asset_valuations (user_id, asset_id, month, value, created_at)
select user_id, id, date_trunc('month', (updated_at at time zone 'America/Sao_Paulo')::date)::date, value, updated_at
from public.assets
on conflict (asset_id, month) do nothing;

create or replace function public.upsert_asset(
  p_name text,
  p_category public.asset_category,
  p_value numeric,
  p_for_retirement boolean,
  p_note text default null,
  p_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_old numeric;
  v_month date := date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if p_value is null or p_value < 0 then raise exception 'valor invalido'; end if;

  if p_id is null then
    insert into public.assets (user_id, name, category, value, for_retirement, note)
    values (v_user, btrim(p_name), p_category, p_value, p_for_retirement, p_note)
    returning id into v_id;
  else
    select value into v_old from public.assets where id = p_id and user_id = v_user for update;
    update public.assets set
      name = btrim(p_name), category = p_category, value = p_value,
      for_retirement = p_for_retirement, note = p_note, updated_at = now()
    where id = p_id and user_id = v_user
    returning id into v_id;
    if v_id is null then raise exception 'item nao encontrado'; end if;
  end if;

  -- Guarda o valor no histórico quando ele muda; no mesmo mês, o novo valor substitui o anterior.
  if v_old is distinct from p_value then
    insert into public.asset_valuations (user_id, asset_id, month, value)
    values (v_user, v_id, v_month, p_value)
    on conflict (asset_id, month) do update set value = excluded.value, created_at = now();
  end if;
  -- Sem XP: cadastrar patrimônio não é recompensado.
  return v_id;
end $$;

-- ---------- Registro mensal com os itens que o compõem ----------
alter table public.wealth_entries
  add column breakdown jsonb check (breakdown is null or jsonb_typeof(breakdown) = 'array');

drop function public.log_wealth(date, numeric, numeric, text);
create function public.log_wealth(
  p_month date, p_total numeric, p_previdencia numeric default null, p_note text default null, p_breakdown jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_month date := date_trunc('month', p_month)::date;
  v_current date := date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date;
  v_xp int := 0;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if v_month > v_current then raise exception 'mes futuro nao permitido'; end if;

  insert into public.wealth_entries (user_id, month, total, previdencia, note, breakdown)
  values (v_user, v_month, p_total, p_previdencia, p_note, p_breakdown)
  on conflict (user_id, month) do update set
    total = excluded.total, previdencia = excluded.previdencia, note = excluded.note,
    breakdown = excluded.breakdown, created_at = now();

  -- XP pelo hábito de registrar neste mês, não pelo valor nem pelo mês registrado.
  v_xp := public._award_xp(v_user, 'wealth_logged', 'M:' || to_char(v_current, 'YYYY-MM'), 30, null);
  perform public._mark_week_active(v_user);
  return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', v_xp);
end $$;

-- Mesma regra de snapshotFromAssets: entra só o que é para a aposentadoria; dívidas e rendas ficam de fora.
create or replace function public.log_wealth_from_assets(p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_total numeric;
  v_previdencia numeric;
  v_breakdown jsonb;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if not exists (select 1 from public.assets where user_id = v_user) then
    raise exception 'nenhum item cadastrado';
  end if;

  select
    coalesce(sum(value), 0),
    coalesce(sum(value) filter (where category in ('pgbl', 'vgbl')), 0),
    coalesce(jsonb_agg(jsonb_build_object('assetId', id, 'name', name, 'category', category, 'value', value) order by created_at), '[]'::jsonb)
  into v_total, v_previdencia, v_breakdown
  from public.assets
  where user_id = v_user and for_retirement and category not in ('divida', 'beneficio');

  return public.log_wealth((now() at time zone 'America/Sao_Paulo')::date, v_total, v_previdencia, p_note, v_breakdown);
end $$;

-- ---------- Exportação inclui o histórico dos itens ----------
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
grant select on public.asset_valuations to authenticated;
grant all on public.asset_valuations to service_role;

revoke execute on function public.log_wealth(date, numeric, numeric, text, jsonb) from public, anon;
revoke execute on function public.log_wealth_from_assets(text) from public, anon;
grant execute on function public.log_wealth(date, numeric, numeric, text, jsonb), public.log_wealth_from_assets(text) to authenticated;
