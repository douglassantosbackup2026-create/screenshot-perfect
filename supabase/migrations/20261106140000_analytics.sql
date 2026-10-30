-- Analytics próprio, só com consentimento: funil landing → calculadora → cadastro → assinatura.
-- Sem terceiros. Ninguém lê as tabelas direto: escrita por RPCs validadas, leitura só pelo admin.

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  -- Id aleatório do navegador (criado só depois do "aceito"). Nulo nos eventos do servidor.
  anon_id uuid,
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (name in (
    'landing_view', 'calculator_used', 'lead_saved', 'signup_completed', 'checkout_started', 'subscription_authorized'
  )),
  path text check (char_length(path) <= 200),
  utm_source text check (char_length(utm_source) <= 100),
  utm_medium text check (char_length(utm_medium) <= 100),
  utm_campaign text check (char_length(utm_campaign) <= 100),
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 2048),
  check (anon_id is not null or user_id is not null)
);
create index on public.analytics_events (at);
create index on public.analytics_events (anon_id, at);
create index on public.analytics_events (user_id) where user_id is not null;
alter table public.analytics_events enable row level security;

create table public.consent_log (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  anon_id uuid,
  user_id uuid references auth.users(id) on delete cascade,
  choice text not null check (choice in ('aceito', 'recusado')),
  policy_version text not null check (char_length(policy_version) <= 20)
);
create index on public.consent_log (user_id) where user_id is not null;
alter table public.consent_log enable row level security;

grant insert on public.analytics_events to service_role;

-- ---------- Registrar um evento (navegador) ----------
-- O user_id vem da sessão, nunca do navegador. Limite simples contra enxurrada: 300 eventos/hora por id.
create or replace function public.track_event(p_anon uuid, p_name text, p_path text default null, p_utm jsonb default '{}'::jsonb, p_props jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_anon is null then return; end if;
  if p_name not in ('landing_view', 'calculator_used', 'lead_saved', 'signup_completed', 'checkout_started') then
    raise exception 'evento desconhecido' using errcode = '22023';
  end if;
  if (select count(*) from public.analytics_events where anon_id = p_anon and at > now() - interval '1 hour') >= 300 then
    return;
  end if;
  insert into public.analytics_events (anon_id, user_id, name, path, utm_source, utm_medium, utm_campaign, props)
  values (
    p_anon,
    auth.uid(),
    p_name,
    left(p_path, 200),
    left(p_utm->>'source', 100),
    left(p_utm->>'medium', 100),
    left(p_utm->>'campaign', 100),
    case when pg_column_size(coalesce(p_props, '{}'::jsonb)) <= 2048 then coalesce(p_props, '{}'::jsonb) else '{}'::jsonb end
  );
end;
$$;
revoke execute on function public.track_event(uuid, text, text, jsonb, jsonb) from public;
grant execute on function public.track_event(uuid, text, text, jsonb, jsonb) to anon, authenticated;

-- ---------- Registrar a escolha do banner ----------
-- Com sessão, também guarda a escolha no perfil (o servidor só registra a assinatura de quem aceitou)
-- e liga o id do navegador à conta, para o funil seguir a mesma pessoa depois do cadastro.
create or replace function public.record_consent(p_anon uuid, p_choice text, p_version text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
begin
  if p_choice not in ('aceito', 'recusado') then raise exception 'escolha inválida' using errcode = '22023'; end if;
  if p_anon is null and v_user is null then return; end if;
  insert into public.consent_log (anon_id, user_id, choice, policy_version)
  values (p_anon, v_user, p_choice, left(p_version, 20));
  if v_user is not null then
    update public.profiles set analytics_consent = (p_choice = 'aceito') where id = v_user;
  end if;
end;
$$;
revoke execute on function public.record_consent(uuid, text, text) from public;
grant execute on function public.record_consent(uuid, text, text) to anon, authenticated;

-- ---------- Funil (admin) ----------
-- Pessoa = id do navegador; eventos só com conta (assinatura) usam o id do navegador ligado à conta
-- pelo cadastro ou pelo consentimento. Origem = utm_source do primeiro evento da pessoa no período.
create or replace function public.admin_funnel(p_from date, p_to date)
returns table (step text, source text, people bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  return query
  with links as (
    select distinct on (user_id) user_id, anon_id from (
      select user_id, anon_id, at from public.analytics_events where user_id is not null and anon_id is not null
      union all
      select user_id, anon_id, at from public.consent_log where user_id is not null and anon_id is not null
    ) x order by user_id, at
  ),
  ev as (
    select
      e.name,
      e.at,
      e.utm_source,
      coalesce(e.anon_id::text, l.anon_id::text, e.user_id::text) as person
    from public.analytics_events e
    left join links l on l.user_id = e.user_id
    where e.at >= p_from::timestamptz and e.at < (p_to + 1)::timestamptz
  ),
  origin as (
    select distinct on (person) person, coalesce(nullif(utm_source, ''), '(direto)') as src
    from ev order by person, at
  )
  select ev.name, o.src, count(distinct ev.person)
  from ev join origin o using (person)
  group by ev.name, o.src;
end;
$$;
revoke execute on function public.admin_funnel(date, date) from public, anon;
grant execute on function public.admin_funnel(date, date) to authenticated;
