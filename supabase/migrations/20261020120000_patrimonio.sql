-- Patrimônio item a item, objetivo e revisão do onboarding, e XP pelo registro do mês (não pelo aporte).
-- Espelha src/lib/calc/assets.ts, src/lib/data/demo-store.ts e src/lib/gamification/rules.ts.
-- Itens do patrimônio não geram XP, conquistas nem rankings.

-- ---------- Onboarding: objetivo, revisão e dados ausentes ----------
alter table public.profiles
  add column objective text check (objective is null or objective in ('entender', 'organizar', 'previdencia')),
  add column review_cadence text not null default 'trimestral' check (review_cadence in ('mensal', 'trimestral', 'semestral')),
  add column missing_fields text[] not null default '{}'
    check (missing_fields <@ array['idade', 'renda', 'patrimonio', 'aporte']::text[]);

-- ---------- Patrimônio item a item ----------
create type public.asset_category as enum (
  'pgbl', 'vgbl', 'investimentos', 'reserva', 'imovel', 'beneficio', 'divida', 'outro'
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  category public.asset_category not null,
  -- Saldo em R$; para 'beneficio', valor mensal estimado.
  value numeric(14,2) not null check (value >= 0),
  -- Só ativos (não dívidas nem rendas) entram no total para a aposentadoria.
  for_retirement boolean not null default true,
  note text check (note is null or char_length(note) <= 280),
  source text not null default 'manual' check (source in ('manual')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.assets(user_id);
alter table public.assets enable row level security;
create policy "ativos: ler os proprios" on public.assets
  for select to authenticated using (user_id = auth.uid());
create policy "ativos: excluir os proprios" on public.assets
  for delete to authenticated using (user_id = auth.uid());
-- Criação e edição apenas por upsert_asset

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
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if p_value is null or p_value < 0 then raise exception 'valor invalido'; end if;

  if p_id is null then
    insert into public.assets (user_id, name, category, value, for_retirement, note)
    values (v_user, btrim(p_name), p_category, p_value, p_for_retirement, p_note)
    returning id into v_id;
  else
    update public.assets set
      name = btrim(p_name), category = p_category, value = p_value,
      for_retirement = p_for_retirement, note = p_note, updated_at = now()
    where id = p_id and user_id = v_user
    returning id into v_id;
    if v_id is null then raise exception 'item nao encontrado'; end if;
  end if;
  -- Sem XP: cadastrar patrimônio não é recompensado.
  return v_id;
end $$;

-- ---------- XP pelo registro do mês, com ou sem aporte ----------
create or replace function public.log_contribution(
  p_month date,
  p_made boolean,
  p_amount numeric default null,
  p_destination public.contribution_destination default null,
  p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_month date := date_trunc('month', p_month)::date;
  v_current date := date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date;
  v_xp int := 0;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if v_month > v_current then raise exception 'mes futuro nao permitido'; end if;

  insert into public.contributions (user_id, month, made_contribution, amount, destination, note)
  values (v_user, v_month, p_made, case when p_made then p_amount else null end, p_destination, p_note);

  -- XP pelo hábito de registrar o mês (inclusive "não aportei"), nunca pelo valor aportado.
  if v_month >= (v_current - interval '1 month')::date then
    v_xp := public._award_xp(v_user, 'contribution_logged', 'M:' || to_char(v_month, 'YYYY-MM'), 20, null);
  end if;

  perform public._mark_week_active(v_user);
  return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', v_xp);
end $$;

update public.achievements set title = 'Primeiro mês registrado'
  where code = 'primeiro_aporte';
update public.achievements set description = 'Você registrou três meses seguidos, com ou sem aporte.'
  where code = 'tres_meses_seguidos';

-- ---------- Exportação inclui o patrimônio item a item ----------
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
grant select, delete on public.assets to authenticated;
grant all on public.assets to service_role;

revoke execute on function public.upsert_asset(text, public.asset_category, numeric, boolean, text, uuid) from public, anon;
grant execute on function public.upsert_asset(text, public.asset_category, numeric, boolean, text, uuid) to authenticated;
