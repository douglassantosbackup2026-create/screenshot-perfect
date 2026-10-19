-- =========================================================
-- Previdência Intelligence — migração inicial (MVP)
-- =========================================================
create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type public.app_role as enum ('admin', 'user');
create type public.work_type as enum ('pj', 'autonomo', 'mei', 'clt', 'servidor', 'outro');
create type public.content_status as enum ('rascunho', 'revisada', 'publicada');
create type public.xp_action as enum (
  'lesson_completed', 'quiz_correct', 'weekly_mission', 'first_plan_created',
  'contribution_logged', 'plan_quick_review', 'plan_life_event',
  'program_completed', 'annual_review'
);
create type public.contribution_destination as enum ('previdencia', 'investimentos', 'reserva', 'outro');
create type public.snapshot_reason as enum ('created', 'edit', 'quick_review', 'life_event', 'annual_review');
create type public.week_status as enum ('ativa', 'pausa');

-- ---------- Papéis ----------
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "papeis: ler os proprios" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

-- ---------- Perfil ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  birth_year int check (birth_year between 1930 and 2015),
  work_type public.work_type,
  has_overdue_debt boolean,
  emergency_fund_ready boolean not null default false,
  monthly_reminder boolean not null default true,
  reminder_day int not null default 5 check (reminder_day between 1 and 28),
  weekly_reminder boolean not null default true,
  analytics_consent boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "perfil: ler o proprio" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "perfil: atualizar o proprio" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------- Plano de aposentadoria ----------
create table public.retirement_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Meu plano' check (char_length(name) <= 60),
  is_primary boolean not null default true,
  current_age int not null check (current_age between 16 and 90),
  retirement_age int not null check (retirement_age between 30 and 90),
  horizon_age int not null default 95 check (horizon_age between 60 and 110),
  initial_wealth numeric(14,2) not null default 0 check (initial_wealth >= 0),
  monthly_contribution numeric(12,2) not null default 0 check (monthly_contribution >= 0),
  desired_monthly_income numeric(12,2) not null check (desired_monthly_income > 0),
  inss_estimate numeric(12,2) check (inss_estimate is null or inss_estimate >= 0),
  return_conservative numeric(6,4) not null default 0.02,
  return_central numeric(6,4) not null default 0.04,
  return_optimistic numeric(6,4) not null default 0.06,
  inflation_aa numeric(6,4) not null default 0.04,
  costs_aa numeric(6,4) not null default 0 check (costs_aa >= 0 and costs_aa < 0.1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (retirement_age > current_age),
  check (horizon_age > retirement_age),
  check (return_conservative between -0.05 and 0.15),
  check (return_central between -0.05 and 0.15),
  check (return_optimistic between -0.05 and 0.15)
);
create unique index retirement_plans_one_primary on public.retirement_plans(user_id) where is_primary;
alter table public.retirement_plans enable row level security;
create policy "plano: ler o proprio" on public.retirement_plans
  for select to authenticated using (user_id = auth.uid());
create policy "plano: criar o proprio" on public.retirement_plans
  for insert to authenticated with check (user_id = auth.uid());
create policy "plano: atualizar o proprio" on public.retirement_plans
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "plano: excluir o proprio" on public.retirement_plans
  for delete to authenticated using (user_id = auth.uid());

-- Histórico de simulações (cada salvamento ou revisão)
create table public.plan_snapshots (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.retirement_plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason public.snapshot_reason not null,
  engine_version text not null,
  inputs jsonb not null,
  outputs jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.plan_snapshots(user_id, created_at desc);
alter table public.plan_snapshots enable row level security;
create policy "historico: ler o proprio" on public.plan_snapshots
  for select to authenticated using (user_id = auth.uid());
create policy "historico: excluir o proprio" on public.plan_snapshots
  for delete to authenticated using (user_id = auth.uid());

-- ---------- Aportes registrados ----------
create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  made_contribution boolean not null default true,
  amount numeric(12,2) check (amount is null or amount >= 0),
  destination public.contribution_destination,
  note text check (note is null or char_length(note) <= 280),
  created_at timestamptz not null default now()
);
create index on public.contributions(user_id, month);
alter table public.contributions enable row level security;
create policy "aportes: ler os proprios" on public.contributions
  for select to authenticated using (user_id = auth.uid());
create policy "aportes: atualizar os proprios" on public.contributions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "aportes: excluir os proprios" on public.contributions
  for delete to authenticated using (user_id = auth.uid());
-- Inserção apenas pela função log_contribution (sem policy de insert)

-- ---------- Conteúdo ----------
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  total_days int not null check (total_days between 1 and 60),
  is_premium boolean not null default false,
  status public.content_status not null default 'rascunho',
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  day int not null check (day >= 1),
  title text not null,
  objective text not null,
  key_points jsonb not null default '[]'::jsonb,
  body_md text,
  action_key text check (action_key in ('set_goal', 'create_plan', 'first_contribution')),
  sources jsonb not null default '[]'::jsonb,
  reviewed_by text,
  reviewed_at date,
  status public.content_status not null default 'rascunho',
  unique (program_id, day)
);

create table public.lesson_questions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  position int not null check (position between 1 and 5),
  prompt text not null,
  options jsonb not null,
  correct_option text not null,
  explanation text not null,
  unique (lesson_id, position)
);

create table public.weekly_missions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  action_hint text check (action_hint in ('plan_quick_review', 'micro_lesson', 'challenge', 'reflection')),
  sort_order int not null default 0,
  status public.content_status not null default 'rascunho'
);

create table public.achievements (
  code text primary key,
  title text not null,
  description text not null,
  icon text not null
);

alter table public.programs enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_questions enable row level security;
alter table public.weekly_missions enable row level security;
alter table public.achievements enable row level security;

create policy "programas: ler publicados" on public.programs
  for select to authenticated using (status = 'publicada' or public.has_role(auth.uid(), 'admin'));
create policy "licoes: ler publicadas" on public.lessons
  for select to authenticated using (status = 'publicada' or public.has_role(auth.uid(), 'admin'));
create policy "missoes: ler publicadas" on public.weekly_missions
  for select to authenticated using (status = 'publicada' or public.has_role(auth.uid(), 'admin'));
create policy "conquistas: ler" on public.achievements
  for select to authenticated using (true);
create policy "perguntas: so admin le" on public.lesson_questions
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create policy "programas: admin escreve" on public.programs
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "licoes: admin escreve" on public.lessons
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "perguntas: admin escreve" on public.lesson_questions
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "missoes: admin escreve" on public.weekly_missions
  for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- ---------- Progresso ----------
create table public.user_program_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  started_at timestamptz not null default now(),
  current_day int not null default 1,
  completed_at timestamptz,
  primary key (user_id, program_id)
);

create table public.lesson_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.question_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.lesson_questions(id) on delete cascade,
  selected_option text not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table public.mission_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.weekly_missions(id) on delete cascade,
  iso_week text not null,
  completed_at timestamptz not null default now(),
  unique (user_id, iso_week)
);

alter table public.user_program_progress enable row level security;
alter table public.lesson_completions enable row level security;
alter table public.question_answers enable row level security;
alter table public.mission_completions enable row level security;
create policy "progresso: ler o proprio" on public.user_program_progress
  for select to authenticated using (user_id = auth.uid());
create policy "licoes concluidas: ler as proprias" on public.lesson_completions
  for select to authenticated using (user_id = auth.uid());
create policy "respostas: ler as proprias" on public.question_answers
  for select to authenticated using (user_id = auth.uid());
create policy "missoes concluidas: ler as proprias" on public.mission_completions
  for select to authenticated using (user_id = auth.uid());

-- ---------- Gamificação ----------
create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type public.xp_action not null,
  ref_id uuid,
  period_key text not null,
  xp int not null check (xp > 0),
  created_at timestamptz not null default now(),
  unique (user_id, action_type, period_key)
);

create table public.week_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  iso_week text not null,
  week_start date not null,
  status public.week_status not null,
  primary key (user_id, iso_week)
);

create table public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_code text not null references public.achievements(code),
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_code)
);

create table public.user_stats (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_xp int not null default 0,
  level int not null default 1,
  week_streak int not null default 0,
  best_week_streak int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.xp_events enable row level security;
alter table public.week_activity enable row level security;
alter table public.user_achievements enable row level security;
alter table public.user_stats enable row level security;
create policy "xp: ler o proprio" on public.xp_events
  for select to authenticated using (user_id = auth.uid());
create policy "semanas: ler as proprias" on public.week_activity
  for select to authenticated using (user_id = auth.uid());
create policy "conquistas do usuario: ler as proprias" on public.user_achievements
  for select to authenticated using (user_id = auth.uid());
create policy "estatisticas: ler as proprias" on public.user_stats
  for select to authenticated using (user_id = auth.uid());

-- ---------- Leads da calculadora pública ----------
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  consent_marketing boolean not null,
  source text not null default 'calculadora',
  created_at timestamptz not null default now()
);
alter table public.leads enable row level security;
create policy "leads: inserir com consentimento" on public.leads
  for insert to anon, authenticated with check (consent_marketing = true);

-- =========================================================
-- Funções internas (não executáveis pelo cliente)
-- =========================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger plans_touch before update on public.retirement_plans
  for each row execute function public.touch_updated_at();

create or replace function public._award_xp(p_user uuid, p_action public.xp_action, p_key text, p_xp int, p_ref uuid default null)
returns int language plpgsql security definer set search_path = public as $$
begin
  insert into public.xp_events (user_id, action_type, ref_id, period_key, xp)
  values (p_user, p_action, p_ref, p_key, p_xp)
  on conflict (user_id, action_type, period_key) do nothing;
  if found then
    return p_xp;
  end if;
  return 0;
end $$;

create or replace function public._mark_week_active(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_start date := date_trunc('week', (now() at time zone 'America/Sao_Paulo')::date)::date;
begin
  insert into public.week_activity (user_id, iso_week, week_start, status)
  values (p_user, to_char(v_start, 'IYYY-"W"IW'), v_start, 'ativa')
  on conflict (user_id, iso_week) do update set status = 'ativa';
end $$;

create or replace function public._refresh_progress(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_week date := date_trunc('week', v_today)::date;
  v_status public.week_status;
  v_streak int := 0;
  v_guard int := 0;
  v_months int;
  v_has_plan boolean;
  v_level int;
  v_total int;
  v_new text[];
begin
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
  ), inserted as (
    insert into public.user_achievements (user_id, achievement_code)
    select p_user, code from candidates
    on conflict do nothing
    returning achievement_code
  )
  select coalesce(array_agg(achievement_code), '{}') into v_new from inserted;

  select coalesce(sum(xp), 0) into v_total from public.xp_events where user_id = p_user;

  insert into public.user_stats as s (user_id, total_xp, level, week_streak, best_week_streak, updated_at)
  values (p_user, v_total, v_level, v_streak, v_streak, now())
  on conflict (user_id) do update set
    total_xp = excluded.total_xp,
    level = excluded.level,
    week_streak = excluded.week_streak,
    best_week_streak = greatest(s.best_week_streak, excluded.week_streak),
    updated_at = now();

  return jsonb_build_object(
    'total_xp', v_total,
    'level', v_level,
    'week_streak', v_streak,
    'new_achievements', to_jsonb(v_new)
  );
end $$;

-- =========================================================
-- RPCs chamadas pelo app
-- =========================================================
create or replace function public.get_my_progress()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'nao autenticado'; end if;
  return public._refresh_progress(auth.uid());
end $$;

create or replace function public.get_lesson_questions(p_lesson uuid)
returns table (id uuid, "position" int, prompt text, options jsonb)
language sql stable security definer set search_path = public as $$
  select q.id, q.position, q.prompt, q.options
  from public.lesson_questions q
  join public.lessons l on l.id = q.lesson_id
  where q.lesson_id = p_lesson and l.status = 'publicada' and auth.uid() is not null
  order by q.position
$$;

create or replace function public.answer_question(p_question uuid, p_option text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_correct text;
  v_expl text;
  v_is boolean;
  v_xp int := 0;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  select q.correct_option, q.explanation into v_correct, v_expl
  from public.lesson_questions q
  join public.lessons l on l.id = q.lesson_id
  where q.id = p_question and l.status = 'publicada';
  if v_correct is null then raise exception 'pergunta nao encontrada'; end if;

  v_is := (p_option = v_correct);
  insert into public.question_answers (user_id, question_id, selected_option, is_correct)
  values (v_user, p_question, p_option, v_is)
  on conflict (user_id, question_id) do nothing;
  if found and v_is then
    v_xp := public._award_xp(v_user, 'quiz_correct', 'Q:' || p_question::text, 2, p_question);
  end if;

  return jsonb_build_object('is_correct', v_is, 'correct_option', v_correct,
                            'explanation', v_expl, 'xp_awarded', v_xp);
end $$;

create or replace function public.complete_lesson(p_lesson uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_program uuid;
  v_day int;
  v_current int;
  v_total int;
  v_done int;
  v_xp int := 0;
  v_local date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  select l.program_id, l.day into v_program, v_day
  from public.lessons l where l.id = p_lesson and l.status = 'publicada';
  if v_program is null then raise exception 'licao nao encontrada'; end if;

  insert into public.user_program_progress (user_id, program_id)
  values (v_user, v_program) on conflict (user_id, program_id) do nothing;

  select current_day into v_current from public.user_program_progress
  where user_id = v_user and program_id = v_program;
  if v_day > v_current then raise exception 'licao ainda bloqueada'; end if;

  insert into public.lesson_completions (user_id, lesson_id)
  values (v_user, p_lesson) on conflict do nothing;
  if found then
    v_xp := v_xp + public._award_xp(v_user, 'lesson_completed',
                                    'D:' || to_char(v_local, 'YYYY-MM-DD'), 10, p_lesson);
  end if;

  update public.user_program_progress
  set current_day = greatest(current_day, v_day + 1)
  where user_id = v_user and program_id = v_program;

  select total_days into v_total from public.programs where id = v_program;
  select count(*) into v_done
  from public.lesson_completions lc join public.lessons l on l.id = lc.lesson_id
  where lc.user_id = v_user and l.program_id = v_program;

  if v_done >= v_total then
    update public.user_program_progress set completed_at = coalesce(completed_at, now())
    where user_id = v_user and program_id = v_program;
    v_xp := v_xp + public._award_xp(v_user, 'program_completed', 'P:' || v_program::text, 200, v_program);
  end if;

  perform public._mark_week_active(v_user);
  return public._refresh_progress(v_user)
         || jsonb_build_object('xp_awarded', v_xp, 'program_completed', v_done >= v_total);
end $$;

create or replace function public.complete_weekly_mission(p_mission uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_start date := date_trunc('week', (now() at time zone 'America/Sao_Paulo')::date)::date;
  v_week text := to_char(v_start, 'IYYY-"W"IW');
  v_xp int := 0;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if not exists (select 1 from public.weekly_missions where id = p_mission and status = 'publicada') then
    raise exception 'missao nao encontrada';
  end if;
  insert into public.mission_completions (user_id, mission_id, iso_week)
  values (v_user, p_mission, v_week) on conflict (user_id, iso_week) do nothing;
  if found then
    v_xp := public._award_xp(v_user, 'weekly_mission', 'W:' || v_week, 30, p_mission);
  end if;
  perform public._mark_week_active(v_user);
  return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', v_xp);
end $$;

create or replace function public.record_plan_event(
  p_plan uuid, p_reason public.snapshot_reason, p_engine_version text, p_inputs jsonb, p_outputs jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_local date := (now() at time zone 'America/Sao_Paulo')::date;
  v_xp int := 0;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if not exists (select 1 from public.retirement_plans where id = p_plan and user_id = v_user) then
    raise exception 'plano nao encontrado';
  end if;

  insert into public.plan_snapshots (plan_id, user_id, reason, engine_version, inputs, outputs)
  values (p_plan, v_user, p_reason, p_engine_version, p_inputs, p_outputs);

  if p_reason = 'created' then
    v_xp := public._award_xp(v_user, 'first_plan_created', 'ONCE', 100, p_plan);
  elsif p_reason = 'quick_review' then
    v_xp := public._award_xp(v_user, 'plan_quick_review', 'M:' || to_char(v_local, 'YYYY-MM'), 20, p_plan);
  elsif p_reason = 'life_event' then
    v_xp := public._award_xp(v_user, 'plan_life_event', 'T:' || to_char(v_local, 'YYYY-"Q"Q'), 40, p_plan);
  elsif p_reason = 'annual_review' and exists (
      select 1 from public.plan_snapshots
      where user_id = v_user and reason = 'created' and created_at < now() - interval '180 days') then
    v_xp := public._award_xp(v_user, 'annual_review', 'Y:' || to_char(v_local, 'YYYY'), 150, p_plan);
  end if;

  perform public._mark_week_active(v_user);
  return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', v_xp);
end $$;

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

  if p_made and v_month >= (v_current - interval '1 month')::date then
    v_xp := public._award_xp(v_user, 'contribution_logged', 'M:' || to_char(v_month, 'YYYY-MM'), 50, null);
  end if;

  perform public._mark_week_active(v_user);
  return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', v_xp);
end $$;

create or replace function public.export_my_data()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = auth.uid()),
    'plans', (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from public.retirement_plans r where r.user_id = auth.uid()),
    'plan_history', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from public.plan_snapshots s where s.user_id = auth.uid()),
    'contributions', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from public.contributions c where c.user_id = auth.uid()),
    'lessons_completed', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from public.lesson_completions l where l.user_id = auth.uid()),
    'answers', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.question_answers a where a.user_id = auth.uid()),
    'missions', (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.mission_completions m where m.user_id = auth.uid()),
    'xp', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.xp_events x where x.user_id = auth.uid()),
    'achievements', (select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb) from public.user_achievements u where u.user_id = auth.uid())
  )
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), 60));
  insert into public.user_stats (user_id) values (new.id);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public._award_xp(uuid, public.xp_action, text, int, uuid) from public, anon, authenticated;
revoke execute on function public._mark_week_active(uuid) from public, anon, authenticated;
revoke execute on function public._refresh_progress(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

insert into public.achievements (code, title, description, icon) values
  ('primeiro_plano', 'Primeiro plano', 'Você criou seu plano de aposentadoria.', 'map'),
  ('primeiro_aporte', 'Primeiro aporte', 'Seu fio da constância começou.', 'sprout'),
  ('tres_meses_seguidos', 'Três meses de constância', 'Aportes registrados em três meses seguidos.', 'calendar-check'),
  ('reserva_montada', 'Reserva de emergência', 'Você informou que sua reserva está montada.', 'shield'),
  ('plano_ajustado', 'Plano ajustado', 'Você revisou o plano depois de uma mudança de vida.', 'refresh-cw'),
  ('programa_21_concluido', '21 dias concluídos', 'Você terminou o programa Meu plano sem depender do INSS.', 'flag'),
  ('primeira_revisao_anual', 'Primeira revisão anual', 'Você fez a revisão completa do seu plano.', 'award');

insert into public.programs (slug, title, description, total_days, is_premium, status) values
  ('plano-sem-inss-21', 'Meu plano sem depender do INSS',
   'Em 21 dias, entenda o essencial, monte seu plano e registre seu primeiro aporte.', 21, false, 'rascunho');

-- ---------- Acesso pela API (exigido pelo Supabase) ----------
grant select on public.user_roles, public.programs, public.lessons, public.lesson_questions, public.weekly_missions, public.achievements, public.user_program_progress, public.lesson_completions, public.question_answers, public.mission_completions, public.xp_events, public.week_activity, public.user_achievements, public.user_stats, public.plan_snapshots to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.retirement_plans to authenticated;
grant delete on public.plan_snapshots to authenticated;
grant select, update, delete on public.contributions to authenticated;
grant insert, update, delete on public.programs, public.lessons, public.lesson_questions, public.weekly_missions to authenticated;
grant insert on public.leads to anon, authenticated;
grant all on all tables in schema public to service_role;