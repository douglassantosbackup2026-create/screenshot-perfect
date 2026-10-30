-- Back-office mínimo: o editor de conteúdo grava de verdade e o admin encontra uma pessoa com a
-- assinatura e os pagamentos dela. Tudo exige is_admin(); quem não é admin recebe erro.

-- ---------- Regra de publicação (§9.10) também no banco ----------
-- A tela já bloqueia (src/lib/content-rules.ts); aqui vale para qualquer caminho de escrita.
create or replace function public.lesson_publish_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'publicada' and (
    coalesce(btrim(new.reviewed_by), '') = ''
    or new.reviewed_at is null
    or not exists (
      select 1 from jsonb_array_elements(coalesce(new.sources, '[]'::jsonb)) s
      where coalesce(btrim(s->>'label'), '') <> '' and coalesce(btrim(s->>'url'), '') <> ''
    )
  ) then
    raise exception 'publicar exige revisor, data de revisão e pelo menos uma fonte' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger lessons_publish_guard
  before insert or update on public.lessons
  for each row execute function public.lesson_publish_guard();

-- ---------- Salvar uma lição com as perguntas, de uma vez ----------
-- p_lesson: { day, title, objective, keyPoints[], bodyMd, actionKey, sources[], reviewedBy, reviewedAt,
--             status, questions[{prompt, options[{id,text}], correct, explanation}] }
-- Perguntas são gravadas por posição (preserva a marcação de nivelamento da jornada).
create or replace function public.admin_save_lesson(p_program_slug text, p_lesson jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_program uuid;
  v_lesson uuid;
  v_count int := coalesce(jsonb_array_length(p_lesson->'questions'), 0);
  q jsonb;
  i int := 0;
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  if v_count > 5 then raise exception 'no máximo 5 perguntas por lição'; end if;

  select id into v_program from public.programs where slug = p_program_slug;
  if v_program is null then raise exception 'programa não encontrado'; end if;

  insert into public.lessons as l (program_id, day, title, objective, key_points, body_md, action_key, sources, reviewed_by, reviewed_at, status)
  values (
    v_program,
    (p_lesson->>'day')::int,
    btrim(p_lesson->>'title'),
    btrim(coalesce(p_lesson->>'objective', '')),
    coalesce(p_lesson->'keyPoints', '[]'::jsonb),
    nullif(p_lesson->>'bodyMd', ''),
    nullif(p_lesson->>'actionKey', ''),
    coalesce(p_lesson->'sources', '[]'::jsonb),
    nullif(btrim(coalesce(p_lesson->>'reviewedBy', '')), ''),
    nullif(p_lesson->>'reviewedAt', '')::date,
    coalesce(p_lesson->>'status', 'rascunho')::public.content_status
  )
  on conflict (program_id, day) do update set
    title = excluded.title,
    objective = excluded.objective,
    key_points = excluded.key_points,
    body_md = excluded.body_md,
    action_key = excluded.action_key,
    sources = excluded.sources,
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    status = excluded.status
  returning l.id into v_lesson;

  for q in select * from jsonb_array_elements(coalesce(p_lesson->'questions', '[]'::jsonb)) loop
    i := i + 1;
    insert into public.lesson_questions (lesson_id, position, prompt, options, correct_option, explanation)
    values (v_lesson, i, q->>'prompt', coalesce(q->'options', '[]'::jsonb), q->>'correct', coalesce(q->>'explanation', ''))
    on conflict (lesson_id, position) do update set
      prompt = excluded.prompt,
      options = excluded.options,
      correct_option = excluded.correct_option,
      explanation = excluded.explanation;
  end loop;
  delete from public.lesson_questions where lesson_id = v_lesson and position > v_count;

  return v_lesson;
end;
$$;

revoke execute on function public.admin_save_lesson(text, jsonb) from public, anon;
grant execute on function public.admin_save_lesson(text, jsonb) to authenticated;

-- ---------- Encontrar uma pessoa (e-mail ou id) com assinatura e pagamentos ----------
create or replace function public.admin_find_users(p_query text)
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  display_name text,
  plan text,
  valid_until timestamptz,
  subscription_status text,
  subscription_period text,
  preapproval_id text,
  subscription_updated_at timestamptz,
  payments jsonb
)
language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  if char_length(v_q) < 3 then return; end if;

  return query
  select
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    p.display_name,
    e.plan,
    e.valid_until,
    s.status,
    s.period,
    s.preapproval_id,
    s.updated_at,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'status', x.status, 'amount_cents', x.amount_cents, 'period', x.period, 'created_at', x.created_at) order by x.created_at desc)
      from (select * from public.payments pm where pm.user_id = u.id order by pm.created_at desc limit 5) x
    ), '[]'::jsonb)
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.entitlements e on e.user_id = u.id
  left join public.subscriptions s on s.user_id = u.id
  where u.email ilike '%' || v_q || '%' or u.id::text = v_q
  order by u.created_at desc
  limit 20;
end;
$$;

revoke execute on function public.admin_find_users(text) from public, anon;
grant execute on function public.admin_find_users(text) to authenticated;
