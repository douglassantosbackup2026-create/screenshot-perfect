-- Jornada estilo Duolingo: 4 unidades com as 21 lições, progresso livre, teste de nivelamento,
-- missão do dia e níveis por XP. Espelha src/content/journey.ts, src/lib/journey/journey.ts,
-- src/lib/gamification/rules.ts e src/lib/data/demo-store.ts.
-- XP vem de aprender e de constância; nunca de valores em reais.

alter type public.xp_action add value if not exists 'daily_mission';

-- ---------- Unidades e ordem da trilha ----------
alter table public.lessons
  add column unit smallint check (unit between 1 and 4),
  add column journey_order smallint check (journey_order >= 1);
alter table public.lesson_questions add column placement boolean not null default false;

update public.lessons l set unit = v.unit, journey_order = v.ord
from (values
  (1, 1, 1),
  (2, 1, 2),
  (4, 1, 3),
  (5, 1, 4),
  (8, 1, 5),
  (6, 2, 6),
  (7, 2, 7),
  (9, 2, 8),
  (11, 2, 9),
  (14, 2, 10),
  (3, 3, 11),
  (10, 3, 12),
  (12, 3, 13),
  (13, 3, 14),
  (16, 3, 15),
  (15, 4, 16),
  (17, 4, 17),
  (18, 4, 18),
  (19, 4, 19),
  (20, 4, 20),
  (21, 4, 21)
) as v(day, unit, ord), public.programs p
where p.id = l.program_id and p.slug = 'plano-sem-inss-21' and l.day = v.day;

update public.lesson_questions q set placement = true
from public.lessons l, public.programs p, (values
  (1, 1),
  (2, 1),
  (5, 1),
  (6, 1),
  (9, 1),
  (11, 1),
  (3, 1),
  (10, 1),
  (12, 1)
) as v(day, position)
where l.id = q.lesson_id and p.id = l.program_id and p.slug = 'plano-sem-inss-21'
  and l.day = v.day and q.position = v.position;

alter table public.user_program_progress add column tested_out_units smallint[] not null default '{}';

-- ---------- Missão do dia ----------
create table public.daily_mission_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('learn', 'quiz', 'goal', 'scenario', 'review', 'rest')),
  completed_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.daily_mission_completions enable row level security;
create policy "missao do dia: ler as proprias" on public.daily_mission_completions
  for select to authenticated using (user_id = auth.uid());
-- Inserção apenas por complete_lesson e complete_daily_mission

-- Uma lição está aberta se todas as anteriores na trilha estão concluídas ou em unidade liberada no teste.
create or replace function public._lesson_unlocked(p_user uuid, p_lesson uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1
    from public.lessons target
    join public.lessons l on l.program_id = target.program_id
    left join public.user_program_progress upp on upp.user_id = p_user and upp.program_id = target.program_id
    where target.id = p_lesson
      and l.status = 'publicada'
      and l.journey_order < target.journey_order
      and not (l.unit = any(coalesce(upp.tested_out_units, '{}')))
      and not exists (select 1 from public.lesson_completions lc where lc.user_id = p_user and lc.lesson_id = l.id))
$$;

-- Tipo da missão de hoje (horário de Brasília), espelho de dailyMission.
create or replace function public._daily_mission_kind(p_user uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_kind text;
  v_done int;
  v_total int;
begin
  v_kind := case extract(isodow from v_today)::int
    when 1 then 'learn' when 2 then 'quiz' when 3 then 'goal'
    when 4 then 'scenario' when 5 then 'review' else 'rest' end;
  select count(*) into v_done from public.lesson_completions where user_id = p_user;
  select count(*) into v_total from public.lessons where status = 'publicada' and journey_order is not null;
  if v_kind in ('quiz', 'review') and v_done = 0 then v_kind := 'learn'; end if;
  if v_kind = 'learn' and v_done >= v_total then v_kind := 'review'; end if;
  return v_kind;
end $$;

create or replace function public._settle_daily_mission(p_user uuid, p_kind text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  insert into public.daily_mission_completions (user_id, day, kind) values (p_user, v_today, p_kind)
  on conflict (user_id, day) do nothing;
  if not found then return 0; end if;
  return public._award_xp(p_user, 'daily_mission', 'D:' || to_char(v_today, 'YYYY-MM-DD'), 10, null);
end $$;

-- ---------- Progresso livre ----------
create or replace function public.complete_lesson(p_lesson uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_program uuid;
  v_day int;
  v_total int;
  v_done int;
  v_xp int := 0;
  v_mission text;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  select l.program_id, l.day into v_program, v_day
  from public.lessons l where l.id = p_lesson and l.status = 'publicada';
  if v_program is null then raise exception 'licao nao encontrada'; end if;

  insert into public.user_program_progress (user_id, program_id)
  values (v_user, v_program) on conflict (user_id, program_id) do nothing;

  if not exists (select 1 from public.lesson_completions where user_id = v_user and lesson_id = p_lesson)
     and not public._lesson_unlocked(v_user, p_lesson) then
    raise exception 'licao ainda bloqueada';
  end if;

  -- A missão do dia é avaliada antes da conclusão, como no app.
  v_mission := public._daily_mission_kind(v_user);

  insert into public.lesson_completions (user_id, lesson_id)
  values (v_user, p_lesson) on conflict do nothing;
  if found then
    -- XP uma vez por lição, sem limite diário.
    v_xp := v_xp + public._award_xp(v_user, 'lesson_completed', 'L:' || p_lesson::text, 10, p_lesson);
    if v_mission in ('learn', 'rest') then
      v_xp := v_xp + public._settle_daily_mission(v_user, 'learn');
    end if;
  end if;

  -- current_day fica por compatibilidade; quem abre lições é a trilha.
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

-- ---------- Teste de nivelamento ----------
-- p_answers: { "dia-posição": "opção" }. Passa quem acerta todas as perguntas de nivelamento da unidade.
create or replace function public.submit_placement(p_unit int, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_program uuid;
  v_first uuid;
  v_total int;
  v_correct int;
  v_passed boolean;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  select l.program_id, l.id into v_program, v_first
  from public.lessons l where l.unit = p_unit and l.status = 'publicada'
  order by l.journey_order limit 1;
  if v_program is null then raise exception 'unidade nao encontrada'; end if;

  insert into public.user_program_progress (user_id, program_id)
  values (v_user, v_program) on conflict (user_id, program_id) do nothing;

  if exists (select 1 from public.user_program_progress
             where user_id = v_user and program_id = v_program and p_unit = any(tested_out_units))
     or not public._lesson_unlocked(v_user, v_first)
     or not exists (select 1 from public.lessons l
                    where l.unit = p_unit and l.status = 'publicada'
                      and not exists (select 1 from public.lesson_completions lc where lc.user_id = v_user and lc.lesson_id = l.id)) then
    raise exception 'teste indisponivel';
  end if;

  select count(*), count(*) filter (where p_answers ->> (l.day::text || '-' || q.position::text) = q.correct_option)
  into v_total, v_correct
  from public.lesson_questions q join public.lessons l on l.id = q.lesson_id
  where l.unit = p_unit and l.status = 'publicada' and q.placement;
  if v_total = 0 then raise exception 'unidade sem teste'; end if;

  v_passed := v_correct = v_total;
  if v_passed then
    update public.user_program_progress
    set tested_out_units = array_append(tested_out_units, p_unit::smallint)
    where user_id = v_user and program_id = v_program;
  end if;
  -- Sem XP: as lições puladas não contam como concluídas.
  return public._refresh_progress(v_user)
         || jsonb_build_object('passed', v_passed, 'correct', v_correct, 'total', v_total, 'xp_awarded', 0);
end $$;

-- ---------- Missão do dia (meta, cenário, quiz e revisão) ----------
-- Quiz e revisão exigem pelo menos 2 acertos em 3 perguntas de lições concluídas.
create or replace function public.complete_daily_mission(p_kind text, p_answers jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_today_kind text;
  v_total int;
  v_correct int;
  v_xp int;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  v_today_kind := public._daily_mission_kind(v_user);
  if not (v_today_kind = p_kind or (v_today_kind = 'rest' and p_kind = 'learn')) then
    raise exception 'nao e a missao de hoje';
  end if;
  if p_kind = 'learn' then raise exception 'use complete_lesson'; end if;

  if p_kind in ('quiz', 'review') then
    select count(*), count(*) filter (where a.value = q.correct_option)
    into v_total, v_correct
    from jsonb_each_text(coalesce(p_answers, '{}'::jsonb)) a
    join public.lessons l on l.day = split_part(a.key, '-', 1)::int and l.status = 'publicada'
    join public.lesson_questions q on q.lesson_id = l.id and q.position = split_part(a.key, '-', 2)::int
    join public.lesson_completions lc on lc.lesson_id = l.id and lc.user_id = v_user;
    if v_total < 3 or v_correct < 2 then raise exception 'revisao abaixo de 2 de 3'; end if;
  end if;

  v_xp := public._settle_daily_mission(v_user, p_kind);
  perform public._mark_week_active(v_user);
  return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', v_xp);
end $$;

-- ---------- Níveis por XP e conquista da Unidade 1 ----------
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
    union all select 'diagnostico_inicial' where exists (
      select 1 from public.lessons where unit = 1 and status = 'publicada')
      and not exists (
        select 1 from public.lessons l
        where l.unit = 1 and l.status = 'publicada'
          and not exists (select 1 from public.lesson_completions lc where lc.user_id = p_user and lc.lesson_id = l.id))
  ), inserted as (
    insert into public.user_achievements (user_id, achievement_code)
    select p_user, code from candidates
    on conflict do nothing
    returning achievement_code
  )
  select coalesce(array_agg(achievement_code), '{}') into v_new from inserted;

  select coalesce(sum(xp), 0) into v_total from public.xp_events where user_id = p_user;
  -- Nível pelo XP (aprendizado e constância), espelho de levelFromXp.
  v_level := case
    when v_total >= 1000 then 5
    when v_total >= 600 then 4
    when v_total >= 300 then 3
    when v_total >= 100 then 2
    else 1
  end;

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

insert into public.achievements (code, title, description, icon) values
  ('diagnostico_inicial', 'Diagnóstico inicial', 'Você concluiu a Unidade 1: conheceu sua realidade.', 'compass')
on conflict (code) do nothing;
update public.achievements set title = 'Jornada concluída', description = 'Você concluiu as quatro unidades da jornada.'
  where code = 'programa_21_concluido';

-- Recalcula nível de quem já tem XP pelas regras novas.
update public.user_stats set level = case
    when total_xp >= 1000 then 5
    when total_xp >= 600 then 4
    when total_xp >= 300 then 3
    when total_xp >= 100 then 2
    else 1
  end;

-- ---------- Permissões ----------
grant select on public.daily_mission_completions to authenticated;
grant all on public.daily_mission_completions to service_role;

revoke execute on function public._lesson_unlocked(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._daily_mission_kind(uuid) from public, anon, authenticated;
revoke execute on function public._settle_daily_mission(uuid, text) from public, anon, authenticated;
revoke execute on function public.submit_placement(int, jsonb) from public, anon;
revoke execute on function public.complete_daily_mission(text, jsonb) from public, anon;
grant execute on function public.submit_placement(int, jsonb), public.complete_daily_mission(text, jsonb) to authenticated;
