-- Evolução patrimonial (lado "Strava"): patrimônio no tempo, metas, desafios pessoais e sequência diária.
-- Espelha src/lib/gamification/rules.ts e src/lib/data/demo-store.ts. O banco segue como fonte da verdade.
-- Reconhece comportamento, nunca o tamanho do patrimônio: valores nunca entram em XP, conquistas ou rankings.

-- ---------- Novas ações de XP ----------
-- Os valores novos só são usados dentro de funções, então podem ser criados nesta mesma migração.
alter type public.xp_action add value if not exists 'wealth_logged';
alter type public.xp_action add value if not exists 'goal_created';
alter type public.xp_action add value if not exists 'goal_completed';
alter type public.xp_action add value if not exists 'challenge_completed';

-- ---------- Privacidade por padrão ----------
alter table public.profiles add column hide_values boolean not null default true;

-- ---------- Patrimônio registrado (um por mês) ----------
create table public.wealth_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  total numeric(14,2) not null check (total >= 0),
  previdencia numeric(14,2) check (previdencia is null or previdencia >= 0),
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now(),
  unique (user_id, month)
);
alter table public.wealth_entries enable row level security;
create policy "patrimonio: ler o proprio" on public.wealth_entries
  for select to authenticated using (user_id = auth.uid());
create policy "patrimonio: atualizar o proprio" on public.wealth_entries
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "patrimonio: excluir o proprio" on public.wealth_entries
  for delete to authenticated using (user_id = auth.uid());
-- Inserção apenas pela função log_wealth (sem policy de insert)

-- ---------- Metas ----------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  kind text not null check (kind in ('valor', 'habito')),
  target numeric(14,2) check (target is null or target > 0),
  deadline date,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (kind = 'habito' or target is not null)
);
create index on public.goals(user_id);
alter table public.goals enable row level security;
create policy "metas: ler as proprias" on public.goals
  for select to authenticated using (user_id = auth.uid());
create policy "metas: excluir as proprias" on public.goals
  for delete to authenticated using (user_id = auth.uid());
-- Criação e conclusão apenas por create_goal e complete_goal

-- ---------- Desafios pessoais (conteúdo) ----------
create table public.challenges (
  slug text primary key,
  title text not null,
  description text not null,
  metric text not null check (metric in ('missions', 'active_days', 'wealth_months', 'plan_reviews', 'goals_completed')),
  target int not null check (target > 0),
  window_days int not null check (window_days > 0),
  sort_order int not null default 0,
  status public.content_status not null default 'rascunho'
);
alter table public.challenges enable row level security;
create policy "desafios: ler publicados" on public.challenges
  for select to authenticated using (status = 'publicada' or public.has_role(auth.uid(), 'admin'));
create policy "desafios: admin escreve" on public.challenges
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.user_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_slug text not null references public.challenges(slug) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index on public.user_challenges(user_id);
alter table public.user_challenges enable row level security;
create policy "desafios do usuario: ler os proprios" on public.user_challenges
  for select to authenticated using (user_id = auth.uid());
create policy "desafios do usuario: desistir" on public.user_challenges
  for delete to authenticated using (user_id = auth.uid() and completed_at is null);

-- ---------- Sequência diária ----------
create table public.day_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.day_activity enable row level security;
create policy "dias: ler os proprios" on public.day_activity
  for select to authenticated using (user_id = auth.uid());

alter table public.user_stats
  add column day_streak int not null default 0,
  add column best_day_streak int not null default 0;

insert into public.achievements (code, title, description, icon) values
  ('primeiro_registro_patrimonio', 'Primeiro registro', 'Você registrou seu patrimônio pela primeira vez.', 'trending-up'),
  ('primeira_meta', 'Primeira meta', 'Você criou sua primeira meta.', 'target'),
  ('meta_concluida', 'Meta concluída', 'Você concluiu uma meta que definiu.', 'check-circle'),
  ('revisao_trimestral', 'Revisão trimestral', 'Patrimônio registrado nos três meses de um trimestre e plano revisado.', 'calendar-range'),
  ('primeiro_desafio', 'Primeiro desafio', 'Você concluiu um desafio pessoal.', 'mountain');

-- =========================================================
-- Funções internas
-- =========================================================
-- Toda atividade marca o dia e a semana.
create or replace function public._mark_week_active(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_start date := date_trunc('week', v_today)::date;
begin
  insert into public.week_activity (user_id, iso_week, week_start, status)
  values (p_user, to_char(v_start, 'IYYY-"W"IW'), v_start, 'ativa')
  on conflict (user_id, iso_week) do update set status = 'ativa';
  insert into public.day_activity (user_id, day) values (p_user, v_today)
  on conflict do nothing;
end $$;

-- Quantos eventos contam para um desafio entre p_from e p_to (datas de Brasília).
create or replace function public._challenge_count(p_user uuid, p_metric text, p_from date, p_to date)
returns int language sql stable security definer set search_path = public as $$
  select case p_metric
    when 'missions' then (
      select count(distinct (completed_at at time zone 'America/Sao_Paulo')::date)::int from public.mission_completions
      where user_id = p_user and (completed_at at time zone 'America/Sao_Paulo')::date between p_from and p_to)
    when 'active_days' then (
      select count(*)::int from public.day_activity
      where user_id = p_user and day between p_from and p_to)
    when 'wealth_months' then (
      select count(distinct date_trunc('month', (created_at at time zone 'America/Sao_Paulo')::date))::int from public.wealth_entries
      where user_id = p_user and (created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to)
    when 'plan_reviews' then (
      select count(distinct (created_at at time zone 'America/Sao_Paulo')::date)::int from public.plan_snapshots
      where user_id = p_user and reason <> 'created' and (created_at at time zone 'America/Sao_Paulo')::date between p_from and p_to)
    when 'goals_completed' then (
      select count(distinct (completed_at at time zone 'America/Sao_Paulo')::date)::int from public.goals
      where user_id = p_user and completed_at is not null and (completed_at at time zone 'America/Sao_Paulo')::date between p_from and p_to)
    else 0
  end
$$;

create or replace function public._refresh_progress(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_week date := date_trunc('week', v_today)::date;
  v_status public.week_status;
  v_streak int := 0;
  v_guard int := 0;
  v_day date;
  v_first date;
  v_day_week date;
  v_protected int := 0;
  v_day_streak int := 0;
  v_ch record;
  v_ch_xp int := 0;
  v_months int;
  v_has_plan boolean;
  v_level int;
  v_total int;
  v_new text[];
begin
  -- Desafios que atingiram a meta dentro da janela são concluídos e dão XP uma vez.
  for v_ch in
    select uc.id, uc.challenge_slug, uc.started_at, c.metric, c.target, c.window_days
    from public.user_challenges uc join public.challenges c on c.slug = uc.challenge_slug
    where uc.user_id = p_user and uc.completed_at is null
  loop
    if public._challenge_count(p_user, v_ch.metric,
         (v_ch.started_at at time zone 'America/Sao_Paulo')::date,
         (v_ch.started_at at time zone 'America/Sao_Paulo')::date + v_ch.window_days - 1) >= v_ch.target then
      update public.user_challenges set completed_at = now() where id = v_ch.id;
      v_ch_xp := v_ch_xp + public._award_xp(p_user, 'challenge_completed',
        'C:' || v_ch.challenge_slug || ':' || v_ch.started_at::text, 40, v_ch.id);
    end if;
  end loop;

  -- Sequência semanal (inalterada)
  if not exists (select 1 from public.week_activity
                 where user_id = p_user and week_start = v_week and status = 'ativa') then
    v_week := v_week - 7;
  end if;

  loop
    v_guard := v_guard + 1;
    exit when v_guard > 520;
    v_status := null;
    select wa.status into v_status from public.week_activity wa
    where wa.user_id = p_user and wa.week_start = v_week;

    if v_status = 'ativa' then
      v_streak := v_streak + 1;
    elsif v_status = 'pausa' then
      null;
    elsif v_streak > 0
      and exists (select 1 from public.week_activity
                  where user_id = p_user and week_start = v_week - 7 and status = 'ativa')
      and not exists (select 1 from public.week_activity
                      where user_id = p_user and status = 'pausa'
                        and date_trunc('month', week_start) = date_trunc('month', v_week)) then
      insert into public.week_activity (user_id, iso_week, week_start, status)
      values (p_user, to_char(v_week, 'IYYY-"W"IW'), v_week, 'pausa')
      on conflict do nothing;
    else
      exit;
    end if;
    v_week := v_week - 7;
  end loop;

  -- Sequência diária: hoje sem atividade não quebra; até 2 dias vazios por semana ficam protegidos.
  select min(day) into v_first from public.day_activity where user_id = p_user;
  v_day := case when exists (select 1 from public.day_activity where user_id = p_user and day = v_today)
                then v_today else v_today - 1 end;
  while v_first is not null and v_day >= v_first and v_day > v_today - 3660 loop
    if v_day_week is distinct from date_trunc('week', v_day)::date then
      v_day_week := date_trunc('week', v_day)::date;
      v_protected := 0;
    end if;
    if exists (select 1 from public.day_activity where user_id = p_user and day = v_day) then
      v_day_streak := v_day_streak + 1;
    else
      exit when v_protected >= 2;
      v_protected := v_protected + 1;
    end if;
    v_day := v_day - 1;
  end loop;

  select count(*) into v_months from public.xp_events
  where user_id = p_user and action_type = 'contribution_logged';
  select exists (select 1 from public.retirement_plans where user_id = p_user) into v_has_plan;
  v_level := case
    when v_months >= 6 then 3
    when v_has_plan and v_months >= 2 then 2
    else 1
  end;

  with candidates(code) as (
    select 'primeiro_plano' where v_has_plan
    union all select 'primeiro_aporte' where v_months >= 1
    union all select 'tres_meses_seguidos' where exists (
      select 1 from (
        select (extract(year from d) * 12 + extract(month from d))::int
               - (row_number() over (order by d))::int as grp
        from (select to_date(substr(period_key, 3), 'YYYY-MM') as d
              from public.xp_events
              where user_id = p_user and action_type = 'contribution_logged') m
      ) g group by grp having count(*) >= 3)
    union all select 'reserva_montada' where exists (
      select 1 from public.profiles where id = p_user and emergency_fund_ready)
    union all select 'plano_ajustado' where exists (
      select 1 from public.plan_snapshots where user_id = p_user and reason = 'life_event')
    union all select 'programa_21_concluido' where exists (
      select 1 from public.user_program_progress upp
      join public.programs p on p.id = upp.program_id
      where upp.user_id = p_user and p.slug = 'plano-sem-inss-21' and upp.completed_at is not null)
    union all select 'primeira_revisao_anual' where exists (
      select 1 from public.xp_events where user_id = p_user and action_type = 'annual_review')
    union all select 'primeiro_registro_patrimonio' where exists (
      select 1 from public.wealth_entries where user_id = p_user)
    union all select 'primeira_meta' where exists (
      select 1 from public.goals where user_id = p_user)
    union all select 'meta_concluida' where exists (
      select 1 from public.goals where user_id = p_user and completed_at is not null)
    union all select 'revisao_trimestral' where exists (
      -- trimestre com patrimônio nos 3 meses e ao menos uma revisão do plano
      select 1 from public.plan_snapshots s
      where s.user_id = p_user and s.reason <> 'created'
        and (select count(*) from public.wealth_entries w
             where w.user_id = p_user
               and date_trunc('quarter', w.month) = date_trunc('quarter', (s.created_at at time zone 'America/Sao_Paulo')::date)) = 3)
    union all select 'primeiro_desafio' where exists (
      select 1 from public.user_challenges where user_id = p_user and completed_at is not null)
  ), inserted as (
    insert into public.user_achievements (user_id, achievement_code)
    select p_user, code from candidates
    on conflict do nothing
    returning achievement_code
  )
  select coalesce(array_agg(achievement_code), '{}') into v_new from inserted;

  select coalesce(sum(xp), 0) into v_total from public.xp_events where user_id = p_user;

  insert into public.user_stats as s (user_id, total_xp, level, week_streak, best_week_streak, day_streak, best_day_streak, updated_at)
  values (p_user, v_total, v_level, v_streak, v_streak, v_day_streak, v_day_streak, now())
  on conflict (user_id) do update set
    total_xp = excluded.total_xp,
    level = excluded.level,
    week_streak = excluded.week_streak,
    best_week_streak = greatest(s.best_week_streak, excluded.week_streak),
    day_streak = excluded.day_streak,
    best_day_streak = greatest(s.best_day_streak, excluded.day_streak),
    updated_at = now();

  return jsonb_build_object(
    'total_xp', v_total,
    'level', v_level,
    'week_streak', v_streak,
    'day_streak', v_day_streak,
    'challenge_xp', v_ch_xp,
    'new_achievements', to_jsonb(v_new)
  );
end $$;

-- =========================================================
-- RPCs chamadas pelo app
-- =========================================================
create or replace function public.log_wealth(
  p_month date, p_total numeric, p_previdencia numeric default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_month date := date_trunc('month', p_month)::date;
  v_current date := date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date;
  v_xp int := 0;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if v_month > v_current then raise exception 'mes futuro nao permitido'; end if;

  insert into public.wealth_entries (user_id, month, total, previdencia, note)
  values (v_user, v_month, p_total, p_previdencia, p_note)
  on conflict (user_id, month) do update set
    total = excluded.total, previdencia = excluded.previdencia, note = excluded.note, created_at = now();

  -- XP pelo hábito de registrar neste mês, não pelo valor nem pelo mês registrado.
  v_xp := public._award_xp(v_user, 'wealth_logged', 'M:' || to_char(v_current, 'YYYY-MM'), 30, null);
  perform public._mark_week_active(v_user);
  return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', v_xp);
end $$;

create or replace function public.create_goal(
  p_title text, p_kind text, p_target numeric default null, p_deadline date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_month text := to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM');
  v_id uuid;
  v_xp int := 0;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  insert into public.goals (user_id, title, kind, target, deadline)
  values (v_user, btrim(p_title), p_kind, case when p_kind = 'valor' then p_target else null end, p_deadline)
  returning id into v_id;

  -- No máximo 3 metas com XP por mês.
  if (select count(*) from public.xp_events
      where user_id = v_user and action_type = 'goal_created' and period_key like 'G:' || v_month || ':%') < 3 then
    v_xp := public._award_xp(v_user, 'goal_created', 'G:' || v_month || ':' || v_id::text, 20, v_id);
  end if;
  perform public._mark_week_active(v_user);
  return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', v_xp, 'goal_id', v_id);
end $$;

create or replace function public.complete_goal(p_goal uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_xp int := 0;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  update public.goals set completed_at = now()
  where id = p_goal and user_id = v_user and completed_at is null;
  if found then
    v_xp := public._award_xp(v_user, 'goal_completed', 'G:' || p_goal::text, 60, p_goal);
    perform public._mark_week_active(v_user);
  end if;
  return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', v_xp);
end $$;

create or replace function public.start_challenge(p_slug text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_running int;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if not exists (select 1 from public.challenges where slug = p_slug and status = 'publicada') then
    raise exception 'desafio nao encontrado';
  end if;
  -- Em andamento: não concluído e ainda dentro da janela.
  select count(*) into v_running from public.user_challenges uc join public.challenges c on c.slug = uc.challenge_slug
  where uc.user_id = v_user and uc.completed_at is null
    and (uc.started_at at time zone 'America/Sao_Paulo')::date + c.window_days - 1 >= v_today;
  if exists (select 1 from public.user_challenges uc join public.challenges c on c.slug = uc.challenge_slug
             where uc.user_id = v_user and uc.challenge_slug = p_slug and uc.completed_at is null
               and (uc.started_at at time zone 'America/Sao_Paulo')::date + c.window_days - 1 >= v_today) then
    return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', 0);
  end if;
  if v_running >= 2 then raise exception 'limite de desafios em andamento'; end if;

  insert into public.user_challenges (user_id, challenge_slug) values (v_user, p_slug);
  return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', 0);
end $$;

create or replace function public.export_my_data()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'plans', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.retirement_plans r where r.user_id = auth.uid()),
    'plan_history', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.plan_snapshots s where s.user_id = auth.uid()),
    'contributions', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.contributions c where c.user_id = auth.uid()),
    'wealth', (select coalesce(jsonb_agg(to_jsonb(w)), '[]'::jsonb) from public.wealth_entries w where w.user_id = auth.uid()),
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
grant select on public.challenges, public.user_challenges, public.day_activity, public.goals to authenticated;
grant select, update, delete on public.wealth_entries to authenticated;
grant delete on public.goals, public.user_challenges to authenticated;
grant insert, update, delete on public.challenges to authenticated;
grant all on public.wealth_entries, public.goals, public.challenges, public.user_challenges, public.day_activity to service_role;

revoke execute on function public._challenge_count(uuid, text, date, date) from public, anon, authenticated;
revoke execute on function public.log_wealth(date, numeric, numeric, text) from public, anon;
revoke execute on function public.create_goal(text, text, numeric, date) from public, anon;
revoke execute on function public.complete_goal(uuid) from public, anon;
revoke execute on function public.start_challenge(text) from public, anon;
grant execute on function public.log_wealth(date, numeric, numeric, text), public.create_goal(text, text, numeric, date),
  public.complete_goal(uuid), public.start_challenge(text) to authenticated;
