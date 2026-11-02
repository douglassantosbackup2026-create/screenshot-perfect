-- Painel administrativo: perfis de acesso da equipe, métricas reais (contagem anônima + eventos com aceite),
-- faturamento, atendimento, incidentes, leads, aviso no app e premissas da calculadora.
-- Regra de privacidade: nenhuma função daqui devolve patrimônio, transações ou metas de uma pessoa; o uso das
-- funcionalidades sai só em contagens agregadas, e grupos com menos de 5 pessoas não são mostrados.

-- =========================================================
-- 1. Perfis da equipe
-- =========================================================
create table public.staff_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('super_admin', 'financeiro', 'marketing', 'suporte', 'analista')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.staff_roles enable row level security;
revoke all on public.staff_roles from anon, authenticated;
grant all on public.staff_roles to service_role;

-- Quem chama tem algum dos papéis? O admin de user_roles vale como super_admin (is_admin já exige o segundo
-- fator de quem o ativou); papéis da equipe também respeitam o segundo fator.
create or replace function public.staff_has(p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
    or (public._mfa_ok() and exists (
      select 1 from public.staff_roles
       where user_id = auth.uid() and (role = 'super_admin' or role = any(p_roles))))
$$;
revoke execute on function public.staff_has(text[]) from public, anon;
grant execute on function public.staff_has(text[]) to authenticated;

-- Para montar o menu: papéis de quem chama e se falta confirmar o segundo fator.
create or replace function public.my_staff_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'roles', to_jsonb(array(
      select r from (
        select 'super_admin' as r where public.is_admin()
        union
        select role from public.staff_roles where user_id = auth.uid() and public._mfa_ok()
      ) x order by 1)),
    'mfa_needed', (public.has_admin_role() or exists (select 1 from public.staff_roles where user_id = auth.uid()))
                  and not public._mfa_ok()
  )
$$;
revoke execute on function public.my_staff_status() from public, anon;
grant execute on function public.my_staff_status() to authenticated;

create or replace function public._is_super()
returns boolean language sql stable security definer set search_path = public as $$
  select public.staff_has(array['super_admin'])
$$;
revoke execute on function public._is_super() from public, anon, authenticated;

create or replace function public.admin_staff_list()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public._is_super() then raise exception 'apenas super admin' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'email') from (
      select jsonb_build_object(
        'user_id', u.id, 'email', u.email,
        'roles', to_jsonb(array(
          select r from (
            select 'super_admin' as r where exists (select 1 from public.user_roles ur where ur.user_id = u.id and ur.role = 'admin')
            union select sr.role from public.staff_roles sr where sr.user_id = u.id) y order by 1)),
        'legacy_admin', exists (select 1 from public.user_roles ur where ur.user_id = u.id and ur.role = 'admin'),
        'mfa', exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
        'last_sign_in_at', u.last_sign_in_at) as x
      from auth.users u
      where exists (select 1 from public.staff_roles sr where sr.user_id = u.id)
         or exists (select 1 from public.user_roles ur where ur.user_id = u.id and ur.role = 'admin')
    ) t
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_staff_grant(p_email text, p_role text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid;
begin
  if not public._is_super() then raise exception 'apenas super admin' using errcode = '42501'; end if;
  if p_role not in ('super_admin', 'financeiro', 'marketing', 'suporte', 'analista') then raise exception 'perfil inválido'; end if;
  select id into v_user from auth.users where lower(email) = lower(btrim(p_email));
  if v_user is null then raise exception 'nenhuma conta com este e-mail'; end if;
  insert into public.staff_roles (user_id, role, granted_by) values (v_user, p_role, auth.uid()) on conflict do nothing;
  perform public.audit('admin_staff_grant', v_user::text, jsonb_build_object('role', p_role), 'high');
end $$;

create or replace function public.admin_staff_revoke(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._is_super() then raise exception 'apenas super admin' using errcode = '42501'; end if;
  if p_user = auth.uid() and p_role = 'super_admin' then raise exception 'ninguém remove o próprio super admin'; end if;
  delete from public.staff_roles where user_id = p_user and role = p_role;
  perform public.audit('admin_staff_revoke', p_user::text, jsonb_build_object('role', p_role), 'high');
end $$;

-- Funções de admin já existentes passam a aceitar o perfil certo, e não só o super admin. A troca é feita no
-- texto da função (só o teste de acesso muda); se algum texto não bater, a migration para em vez de seguir.
do $$
declare
  rec record;
  v_def text;
  v_new text;
begin
  for rec in
    select * from (values
      ('admin_list_affiliates', 'financeiro,marketing'),
      ('admin_review_affiliate', 'financeiro,marketing'),
      ('admin_set_affiliate_status', 'financeiro,marketing'),
      ('admin_affiliate_commissions', 'financeiro,marketing'),
      ('admin_set_commission_status', 'financeiro'),
      ('admin_list_coupons', 'financeiro,marketing'),
      ('admin_save_coupon', 'financeiro,marketing'),
      ('admin_set_coupon_active', 'financeiro,marketing'),
      ('admin_set_plan_price', 'financeiro'),
      ('admin_funnel', 'marketing,analista'),
      ('admin_find_users', 'suporte,financeiro')
    ) as m(fn, roles)
  loop
    select pg_get_functiondef(p.oid) into v_def
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = rec.fn;
    if v_def is null then raise exception 'função % não encontrada', rec.fn; end if;
    v_new := replace(v_def, 'if not public.is_admin() then',
      format('if not public.staff_has(array[%s]) then',
        (select string_agg(quote_literal(r), ', ') from unnest(string_to_array(rec.roles, ',')) r)));
    if v_new = v_def then raise exception 'teste de admin não encontrado em %', rec.fn; end if;
    execute v_new;
  end loop;
end $$;

-- =========================================================
-- 2. Métricas: contagem anônima (sem aceite) e eventos novos (com aceite)
-- =========================================================
create table public.metrics_daily (
  day date not null,
  key text not null check (char_length(key) <= 60),
  n bigint not null default 0,
  primary key (day, key)
);
alter table public.metrics_daily enable row level security;
revoke all on public.metrics_daily from anon, authenticated;
grant all on public.metrics_daily to service_role;

-- Só soma 1 num total do dia. Não recebe nem grava identificador, IP ou página fora da lista.
create or replace function public.count_anonymous(p_key text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_key !~ '^(visita:(/|/calculadora|/cadastro|/entrar|/afiliados|/planos|/contato)|simulacao_iniciada|simulacao_concluida)$' then
    raise exception 'chave desconhecida' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('anon:ip:' || public._client_ip(), 300, 3600) then return; end if;
  insert into public.metrics_daily (day, key, n) values ((now() at time zone 'America/Sao_Paulo')::date, p_key, 1)
  on conflict (day, key) do update set n = public.metrics_daily.n + 1;
end $$;
revoke execute on function public.count_anonymous(text) from public;
grant execute on function public.count_anonymous(text) to anon, authenticated;

alter table public.analytics_events drop constraint if exists analytics_events_name_check;
alter table public.analytics_events add constraint analytics_events_name_check check (name in (
  'landing_view', 'calculator_used', 'lead_saved', 'signup_completed', 'checkout_started', 'subscription_authorized',
  'session_start', 'calculator_started', 'calculator_completed', 'feature_used'
));

create or replace function public.track_event(p_anon uuid, p_name text, p_path text default null, p_utm jsonb default '{}'::jsonb, p_props jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_anon is null then return; end if;
  if p_name not in ('landing_view', 'calculator_used', 'lead_saved', 'signup_completed', 'checkout_started',
                    'session_start', 'calculator_started', 'calculator_completed', 'feature_used') then
    raise exception 'evento desconhecido' using errcode = '22023';
  end if;
  if not public.hit_rate_limit('track:ip:' || public._client_ip(), 600, 3600) then return; end if;
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

-- =========================================================
-- 3. Pagamentos: todo pagamento lido do Mercado Pago (não só os creditados)
-- =========================================================
create table public.payment_events (
  id text primary key check (char_length(id) <= 64),     -- 'mp_<id>'
  user_id uuid references auth.users(id) on delete set null,
  status text not null check (char_length(status) <= 40),
  amount_cents bigint not null check (amount_cents >= 0),
  plan text check (char_length(plan) <= 20),
  period text check (char_length(period) <= 20),
  at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.payment_events (at);
create index on public.payment_events (status, at);
alter table public.payment_events enable row level security;
revoke all on public.payment_events from anon, authenticated;
grant all on public.payment_events to service_role;

-- =========================================================
-- 4. Atendimento
-- =========================================================
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null check (char_length(email) <= 254),
  name text not null default '' check (char_length(name) <= 120),
  kind text not null check (kind in ('duvida', 'sugestao', 'reclamacao', 'erro', 'cancelamento', 'exclusao_dados')),
  subject text not null check (char_length(btrim(subject)) between 3 and 140),
  status text not null default 'aberto' check (status in ('aberto', 'em_andamento', 'resolvido', 'fechado')),
  assignee uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_reply_by text not null default 'usuario' check (last_reply_by in ('usuario', 'equipe'))
);
create index on public.support_tickets (status, updated_at desc);
create index on public.support_tickets (user_id);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author text not null check (author in ('usuario', 'equipe')),
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  at timestamptz not null default now()
);
create index on public.support_messages (ticket_id, at);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
revoke all on public.support_tickets, public.support_messages from anon, authenticated;
grant select on public.support_tickets, public.support_messages to authenticated;
grant all on public.support_tickets, public.support_messages to service_role;
create policy "tickets: ler os proprios" on public.support_tickets for select to authenticated using (user_id = auth.uid());
create policy "mensagens: dos proprios tickets" on public.support_messages for select to authenticated
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));

-- A pessoa abre e responde pelos próprios tickets (status e responsável são da equipe).
create or replace function public.open_ticket(p_kind text, p_subject text, p_body text)
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_id uuid; v_email text; v_name text;
begin
  if auth.uid() is null then raise exception 'sem sessão' using errcode = '42501'; end if;
  if not public.hit_rate_limit('ticket:user:' || auth.uid()::text, 10, 86400) then raise exception 'muitos pedidos hoje'; end if;
  select email into v_email from auth.users where id = auth.uid();
  select coalesce(display_name, '') into v_name from public.profiles where id = auth.uid();
  insert into public.support_tickets (user_id, email, name, kind, subject)
  values (auth.uid(), v_email, left(coalesce(v_name, ''), 120), p_kind, btrim(p_subject)) returning id into v_id;
  insert into public.support_messages (ticket_id, author, author_id, body) values (v_id, 'usuario', auth.uid(), btrim(p_body));
  return v_id;
end $$;

create or replace function public.reply_ticket(p_ticket uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.support_tickets where id = p_ticket and user_id = auth.uid()) then
    raise exception 'chamado não encontrado' using errcode = '42501';
  end if;
  if not public.hit_rate_limit('ticket-reply:user:' || auth.uid()::text, 60, 3600) then raise exception 'muitas mensagens'; end if;
  insert into public.support_messages (ticket_id, author, author_id, body) values (p_ticket, 'usuario', auth.uid(), btrim(p_body));
  update public.support_tickets set updated_at = now(), last_reply_by = 'usuario',
    status = case when status in ('resolvido', 'fechado') then 'aberto' else status end
  where id = p_ticket;
end $$;
revoke execute on function public.open_ticket(text, text, text), public.reply_ticket(uuid, text) from public, anon;
grant execute on function public.open_ticket(text, text, text), public.reply_ticket(uuid, text) to authenticated;

create or replace function public.admin_tickets(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.staff_has(array['suporte']) then raise exception 'apenas suporte' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'email', t.email, 'name', t.name, 'kind', t.kind, 'subject', t.subject, 'status', t.status,
      'assignee', t.assignee, 'assignee_email', (select email from auth.users a where a.id = t.assignee),
      'created_at', t.created_at, 'updated_at', t.updated_at, 'last_reply_by', t.last_reply_by, 'has_account', t.user_id is not null,
      'messages', (select coalesce(jsonb_agg(jsonb_build_object('author', m.author, 'body', m.body, 'at', m.at) order by m.at), '[]'::jsonb)
                     from public.support_messages m where m.ticket_id = t.id)
    ) order by (t.status in ('resolvido', 'fechado')), t.updated_at desc)
    from (select * from public.support_tickets
           where p_status is null or status = p_status
           order by updated_at desc limit 200) t
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_ticket_reply(p_ticket uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.staff_has(array['suporte']) then raise exception 'apenas suporte' using errcode = '42501'; end if;
  insert into public.support_messages (ticket_id, author, author_id, body) values (p_ticket, 'equipe', auth.uid(), btrim(p_body));
  update public.support_tickets set updated_at = now(), last_reply_by = 'equipe',
    status = case when status = 'aberto' then 'em_andamento' else status end,
    assignee = coalesce(assignee, auth.uid())
  where id = p_ticket;
  if not found then raise exception 'chamado não encontrado'; end if;
  perform public.audit('admin_ticket_reply', p_ticket::text, '{}'::jsonb);
end $$;

create or replace function public.admin_ticket_update(p_ticket uuid, p_status text, p_assign_me boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.staff_has(array['suporte']) then raise exception 'apenas suporte' using errcode = '42501'; end if;
  if p_status not in ('aberto', 'em_andamento', 'resolvido', 'fechado') then raise exception 'status inválido'; end if;
  update public.support_tickets set status = p_status, updated_at = now(),
    assignee = case when p_assign_me then auth.uid() else assignee end
  where id = p_ticket;
  if not found then raise exception 'chamado não encontrado'; end if;
  perform public.audit('admin_ticket_update', p_ticket::text, jsonb_build_object('status', p_status));
end $$;

-- =========================================================
-- 5. Incidentes (monitoramento)
-- =========================================================
create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique check (char_length(fingerprint) <= 200),
  source text not null check (source in ('cliente', 'salvamento', 'pagamento', 'push', 'whatsapp', 'cron', 'servidor')),
  level text not null default 'erro' check (level in ('aviso', 'erro', 'critico')),
  message text not null check (char_length(message) <= 500),
  path text check (char_length(path) <= 200),
  count bigint not null default 1,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  status text not null default 'aberto' check (status in ('aberto', 'resolvido')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz
);
create index on public.incidents (status, last_at desc);
alter table public.incidents enable row level security;
revoke all on public.incidents from anon, authenticated;
grant all on public.incidents to service_role;

-- Só o servidor registra. Mesma falha soma na mesma linha; se já estava resolvida, reabre.
create or replace function public.report_incident(p_source text, p_level text, p_message text, p_path text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_msg text := left(regexp_replace(regexp_replace(coalesce(p_message, ''), '[^@\s]+@[^@\s]+', '<email>', 'g'), '\d{3,}', '<n>', 'g'), 500);
begin
  insert into public.incidents (fingerprint, source, level, message, path)
  values (left(p_source || ':' || md5(v_msg), 200), p_source, p_level, v_msg, left(p_path, 200))
  on conflict (fingerprint) do update set
    count = public.incidents.count + 1,
    last_at = now(),
    level = excluded.level,
    path = coalesce(excluded.path, public.incidents.path),
    status = 'aberto',
    resolved_by = case when public.incidents.status = 'resolvido' then null else public.incidents.resolved_by end,
    resolved_at = case when public.incidents.status = 'resolvido' then null else public.incidents.resolved_at end;
end $$;
revoke execute on function public.report_incident(text, text, text, text) from public, anon, authenticated;
grant execute on function public.report_incident(text, text, text, text) to service_role;

create or replace function public.admin_incidents(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.staff_has(array['suporte']) then raise exception 'sem acesso' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(i) order by (i.status = 'resolvido'), i.last_at desc)
    from (select * from public.incidents where p_status is null or status = p_status order by last_at desc limit 300) i
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_resolve_incident(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._is_super() then raise exception 'apenas super admin' using errcode = '42501'; end if;
  update public.incidents set status = 'resolvido', resolved_by = auth.uid(), resolved_at = now() where id = p_id;
  if not found then raise exception 'incidente não encontrado'; end if;
  perform public.audit('admin_incident_resolved', p_id::text, '{}'::jsonb);
end $$;

-- =========================================================
-- 6. Leads: acompanhamento comercial
-- =========================================================
alter table public.leads
  add column if not exists status text not null default 'novo' check (status in ('novo', 'contatado', 'convertido', 'descartado')),
  add column if not exists owner uuid references auth.users(id) on delete set null,
  add column if not exists notes text not null default '' check (char_length(notes) <= 1000);

create or replace function public.admin_leads(p_status text default null, p_query text default null)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare v_q text := lower(btrim(coalesce(p_query, '')));
begin
  if not public.staff_has(array['marketing']) then raise exception 'apenas marketing' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', l.id, 'email', l.email, 'source', l.source, 'created_at', l.created_at,
      'utm_source', l.utm_source, 'utm_campaign', l.utm_campaign, 'notes', l.notes,
      'owner_email', (select email from auth.users o where o.id = l.owner),
      -- Virou conta: conta como convertido mesmo sem ninguém marcar.
      'status', case when l.status = 'novo' and exists (select 1 from auth.users u where lower(u.email) = lower(l.email)) then 'convertido' else l.status end
    ) order by l.created_at desc)
    from (select * from public.leads
           where (v_q = '' or lower(email) like '%' || v_q || '%')
           order by created_at desc limit 500) l
    where p_status is null
       or (case when l.status = 'novo' and exists (select 1 from auth.users u where lower(u.email) = lower(l.email)) then 'convertido' else l.status end) = p_status
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_update_lead(p_id uuid, p_status text, p_notes text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.staff_has(array['marketing']) then raise exception 'apenas marketing' using errcode = '42501'; end if;
  update public.leads set status = p_status, notes = left(coalesce(p_notes, ''), 1000), owner = auth.uid() where id = p_id;
  if not found then raise exception 'lead não encontrado'; end if;
  perform public.audit('admin_lead_update', p_id::text, jsonb_build_object('status', p_status));
end $$;

-- Exportar dados pessoais (CSV de leads) fica registrado.
create or replace function public.admin_log_export(p_what text, p_rows int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.staff_has(array['marketing']) then raise exception 'sem acesso' using errcode = '42501'; end if;
  perform public.audit('admin_export', left(p_what, 60), jsonb_build_object('rows', p_rows), 'warning');
end $$;

-- =========================================================
-- 7. Aviso no app e premissas da calculadora (leitura pública)
-- =========================================================
create table public.site_notices (
  id uuid primary key default gen_random_uuid(),
  text text not null check (char_length(btrim(text)) between 3 and 240),
  link text check (link is null or link ~ '^(https://|/)'),
  active boolean not null default true,
  until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.site_notices enable row level security;
create policy "avisos: todos leem os ativos" on public.site_notices for select to anon, authenticated
  using (active and (until is null or until > now()));
revoke all on public.site_notices from anon, authenticated;
grant select on public.site_notices to anon, authenticated;
grant all on public.site_notices to service_role;

create or replace function public.admin_save_notice(p_id uuid, p_text text, p_link text, p_active boolean, p_until timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.staff_has(array['marketing']) then raise exception 'apenas marketing' using errcode = '42501'; end if;
  if p_id is null then
    insert into public.site_notices (text, link, active, until, created_by)
    values (btrim(p_text), nullif(btrim(coalesce(p_link, '')), ''), p_active, p_until, auth.uid()) returning id into v_id;
  else
    update public.site_notices set text = btrim(p_text), link = nullif(btrim(coalesce(p_link, '')), ''), active = p_active, until = p_until
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'aviso não encontrado'; end if;
  end if;
  perform public.audit('admin_notice_saved', v_id::text, jsonb_build_object('active', p_active));
  return v_id;
end $$;

create or replace function public.admin_list_notices()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.staff_has(array['marketing', 'analista']) then raise exception 'sem acesso' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from public.site_notices n), '[]'::jsonb);
end $$;

create table public.calc_settings (
  id boolean primary key default true check (id),
  return_conservador numeric not null default 0.02 check (return_conservador between -0.05 and 0.15),
  return_central numeric not null default 0.04 check (return_central between -0.05 and 0.15),
  return_otimista numeric not null default 0.06 check (return_otimista between -0.05 and 0.15),
  inflation numeric not null default 0.04 check (inflation between -0.05 and 0.3),
  horizon int not null default 95 check (horizon between 70 and 120),
  costs numeric not null default 0 check (costs >= 0 and costs < 0.1),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  check (return_conservador <= return_central and return_central <= return_otimista)
);
insert into public.calc_settings default values;
alter table public.calc_settings enable row level security;
create policy "calculadora: todos leem" on public.calc_settings for select to anon, authenticated using (true);
revoke all on public.calc_settings from anon, authenticated;
grant select on public.calc_settings to anon, authenticated;
grant all on public.calc_settings to service_role;

create or replace function public.admin_set_calc_settings(p jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_old jsonb;
begin
  if not public._is_super() then raise exception 'apenas super admin' using errcode = '42501'; end if;
  select to_jsonb(c) into v_old from public.calc_settings c;
  update public.calc_settings set
    return_conservador = (p->>'return_conservador')::numeric,
    return_central = (p->>'return_central')::numeric,
    return_otimista = (p->>'return_otimista')::numeric,
    inflation = (p->>'inflation')::numeric,
    horizon = (p->>'horizon')::int,
    costs = (p->>'costs')::numeric,
    updated_at = now(), updated_by = auth.uid();
  perform public.audit('admin_calc_settings', null, jsonb_build_object('from', v_old, 'to', p), 'warning');
end $$;

-- =========================================================
-- 8. Configurações
-- =========================================================
create or replace function public.admin_settings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_super() then raise exception 'apenas super admin' using errcode = '42501'; end if;
  return (select jsonb_build_object('billing_enforced', billing_enforced, 'updated_at', updated_at) from public.app_settings);
end $$;

create or replace function public.admin_set_billing_enforced(p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public._is_super() then raise exception 'apenas super admin' using errcode = '42501'; end if;
  update public.app_settings set billing_enforced = p_on, updated_at = now();
  perform public.audit('admin_billing_enforced', null, jsonb_build_object('on', p_on), 'high');
end $$;

-- =========================================================
-- 9. Relatórios
-- =========================================================
-- Preço de quem assinou antes de o valor ficar gravado na assinatura (MRR das assinaturas antigas).
create or replace function public._legacy_price(p_plan text, p_period text)
returns bigint language sql immutable set search_path = public as $$
  select case when p_plan = 'pro' then 5990 when p_period = 'anual' then 39900 else 3990 end::bigint
$$;
revoke execute on function public._legacy_price(text, text) from public, anon, authenticated;

-- Contagem pequena demais identifica pessoas: abaixo de 5, devolve null (a tela mostra "<5").
create or replace function public._k(p bigint)
returns bigint language sql immutable as $$ select case when p < 5 then null else p end $$;
revoke execute on function public._k(bigint) from public, anon, authenticated;

create or replace function public.admin_overview(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_days int := p_to - p_from + 1;
  v_pfrom date := p_from - (p_to - p_from + 1);
  v_pto date := p_from - 1;
  f timestamptz := p_from::timestamptz;
  t timestamptz := (p_to + 1)::timestamptz;
  pf timestamptz := v_pfrom::timestamptz;
  pt timestamptz := p_from::timestamptz;
begin
  if not public.staff_has(array['financeiro', 'marketing', 'suporte', 'analista']) then raise exception 'sem acesso' using errcode = '42501'; end if;
  if v_days < 1 or v_days > 366 then raise exception 'período de 1 a 366 dias'; end if;
  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'prev_from', v_pfrom, 'prev_to', v_pto),
    'visits', (select coalesce(sum(n), 0) from public.metrics_daily where key like 'visita:%' and day between p_from and p_to),
    'visits_prev', (select coalesce(sum(n), 0) from public.metrics_daily where key like 'visita:%' and day between v_pfrom and v_pto),
    'sim_started', (select coalesce(sum(n), 0) from public.metrics_daily where key = 'simulacao_iniciada' and day between p_from and p_to),
    'sim_completed', (select coalesce(sum(n), 0) from public.metrics_daily where key = 'simulacao_concluida' and day between p_from and p_to),
    'sim_completed_prev', (select coalesce(sum(n), 0) from public.metrics_daily where key = 'simulacao_concluida' and day between v_pfrom and v_pto),
    'unique_visitors', (select count(distinct anon_id) from public.analytics_events where at >= f and at < t and anon_id is not null),
    'sessions', (select count(distinct props->>'session') from public.analytics_events where at >= f and at < t and props ? 'session'),
    'leads', (select count(*) from public.leads where created_at >= f and created_at < t),
    'leads_prev', (select count(*) from public.leads where created_at >= pf and created_at < pt),
    'signups', (select count(*) from auth.users where created_at >= f and created_at < t),
    'signups_prev', (select count(*) from auth.users where created_at >= pf and created_at < pt),
    'users_total', (select count(*) from auth.users),
    'active_subscribers', (select count(*) from public.entitlements where valid_until > now()),
    'mrr_cents', (select coalesce(sum(case when period = 'anual' then coalesce(amount_cents, public._legacy_price(plan, period)) / 12.0
                                          else coalesce(amount_cents, public._legacy_price(plan, period)) end), 0)::bigint
                    from public.subscriptions where status = 'authorized'),
    'new_subscriptions', (select count(*) from public.audit_log where action = 'subscription_status' and details->>'to' = 'authorized'
                            and coalesce(details->>'from', '') <> 'authorized' and at >= f and at < t),
    'new_subscriptions_prev', (select count(*) from public.audit_log where action = 'subscription_status' and details->>'to' = 'authorized'
                            and coalesce(details->>'from', '') <> 'authorized' and at >= pf and at < pt),
    'cancellations', (select count(*) from public.audit_log where action = 'subscription_status' and details->>'to' = 'cancelled' and at >= f and at < t),
    'revenue_cents', (select coalesce(sum(amount_cents), 0) from public.payments where status = 'approved' and created_at >= f and created_at < t),
    'payments_refused', (select count(*) from public.payment_events where status in ('rejected', 'cancelled') and at >= f and at < t),
    'active_7d', public._k((select count(*) from public.user_state where updated_at > now() - interval '7 days')),
    'active_30d', public._k((select count(*) from public.user_state where updated_at > now() - interval '30 days')),
    'incidents_open', (select count(*) from public.incidents where status = 'aberto'),
    'tickets_open', (select count(*) from public.support_tickets where status in ('aberto', 'em_andamento')),
    'tickets_waiting_24h', (select count(*) from public.support_tickets where status in ('aberto', 'em_andamento')
                              and last_reply_by = 'usuario' and updated_at < now() - interval '24 hours'),
    'funnel', jsonb_build_object(
      'sim_completed', (select coalesce(sum(n), 0) from public.metrics_daily where key = 'simulacao_concluida' and day between p_from and p_to),
      'leads', (select count(*) from public.leads where created_at >= f and created_at < t),
      'signups', (select count(*) from auth.users where created_at >= f and created_at < t),
      'subscriptions', (select count(*) from public.audit_log where action = 'subscription_status' and details->>'to' = 'authorized'
                          and coalesce(details->>'from', '') <> 'authorized' and at >= f and at < t)),
    'series', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d,
        'visits', (select coalesce(sum(n), 0) from public.metrics_daily m where m.day = d and m.key like 'visita:%'),
        'sims', (select coalesce(sum(n), 0) from public.metrics_daily m where m.day = d and m.key = 'simulacao_concluida'),
        'signups', (select count(*) from auth.users u where (u.created_at at time zone 'America/Sao_Paulo')::date = d),
        'leads', (select count(*) from public.leads l where (l.created_at at time zone 'America/Sao_Paulo')::date = d)
      ) order by d), '[]'::jsonb)
      from generate_series(p_from, p_to, interval '1 day') g(d0), lateral (select g.d0::date as d) x)
  );
end $$;

create or replace function public.admin_billing(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare f timestamptz := p_from::timestamptz; t timestamptz := (p_to + 1)::timestamptz;
begin
  if not public.staff_has(array['financeiro', 'analista']) then raise exception 'apenas financeiro' using errcode = '42501'; end if;
  return jsonb_build_object(
    'by_plan', coalesce((select jsonb_agg(jsonb_build_object('plan', plan, 'period', period, 'status', status, 'n', n))
                          from (select plan, period, status, count(*) n from public.subscriptions group by 1, 2, 3) x), '[]'::jsonb),
    'active_subscribers', (select count(*) from public.entitlements where valid_until > now()),
    'registered_without_subscription', (select count(*) from auth.users u where not exists (
                                          select 1 from public.entitlements e where e.user_id = u.id and e.valid_until > now())),
    'mrr_cents', (select coalesce(sum(case when period = 'anual' then coalesce(amount_cents, public._legacy_price(plan, period)) / 12.0
                                          else coalesce(amount_cents, public._legacy_price(plan, period)) end), 0)::bigint
                    from public.subscriptions where status = 'authorized'),
    'revenue_cents', (select coalesce(sum(amount_cents), 0) from public.payments where status = 'approved' and created_at >= f and created_at < t),
    'payments_by_status', coalesce((select jsonb_object_agg(status, n) from (
                                     select status, count(*) n from public.payment_events where at >= f and at < t group by 1) x), '{}'::jsonb),
    -- Renovação: pagamento aprovado de quem já tinha pagado antes.
    'renewals', (select count(*) from public.payments p where p.created_at >= f and p.created_at < t
                   and exists (select 1 from public.payments q where q.user_id = p.user_id and q.created_at < p.created_at)),
    'first_payments', (select count(*) from public.payments p where p.created_at >= f and p.created_at < t
                   and not exists (select 1 from public.payments q where q.user_id = p.user_id and q.created_at < p.created_at)),
    'cancellations', (select count(*) from public.audit_log where action = 'subscription_status' and details->>'to' = 'cancelled' and at >= f and at < t),
    'active_at_start', (select count(*) from public.entitlements where valid_until > f),
    'recent_payments', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'email', u.email, 'status', x.status, 'amount_cents', x.amount_cents,
                                          'plan', x.plan, 'period', x.period, 'at', x.at) order by x.at desc)
      from (select * from public.payment_events order by at desc limit 50) x
      left join auth.users u on u.id = x.user_id), '[]'::jsonb)
  );
end $$;

-- Uso das funcionalidades: só contagens, nunca valores. Base: estado salvo de cada pessoa + eventos com aceite.
create or replace function public.admin_feature_usage()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.staff_has(array['marketing', 'analista']) then raise exception 'sem acesso' using errcode = '42501'; end if;
  return (
    with s as (
      select updated_at,
        jsonb_typeof(data->'plan') = 'object' as has_plan,
        coalesce(jsonb_array_length(case when jsonb_typeof(data->'transactions') = 'array' then data->'transactions' end), 0) > 0 as has_tx,
        exists (select 1 from jsonb_array_elements(case when jsonb_typeof(data->'transactions') = 'array' then data->'transactions' else '[]'::jsonb end) e
                 where e->>'date' >= to_char(now() - interval '30 days', 'YYYY-MM-DD')) as tx_30d,
        coalesce(data->'budget'->'assigned', '{}'::jsonb) <> '{}'::jsonb as has_budget,
        coalesce(jsonb_array_length(case when jsonb_typeof(data->'assets') = 'array' then data->'assets' end), 0) > 0 as has_assets,
        coalesce(jsonb_array_length(case when jsonb_typeof(data->'goals') = 'array' then data->'goals' end), 0) > 0 as has_goals,
        coalesce(jsonb_array_length(case when jsonb_typeof(data->'holdings') = 'array' then data->'holdings' end), 0) > 0 as has_holdings,
        coalesce(jsonb_array_length(case when jsonb_typeof(data->'contributions') = 'array' then data->'contributions' end), 0) > 0 as has_contrib
      from public.user_state
    )
    select jsonb_build_object(
      'people', public._k(count(*)),
      'active_7d', public._k(count(*) filter (where updated_at > now() - interval '7 days')),
      'active_30d', public._k(count(*) filter (where updated_at > now() - interval '30 days')),
      'inactive_30d', public._k(count(*) filter (where updated_at <= now() - interval '30 days')),
      'features', jsonb_build_object(
        'plano', public._k(count(*) filter (where has_plan)),
        'lancamentos', public._k(count(*) filter (where has_tx)),
        'lancamentos_30d', public._k(count(*) filter (where tx_30d)),
        'orcamento', public._k(count(*) filter (where has_budget)),
        'patrimonio', public._k(count(*) filter (where has_assets)),
        'metas', public._k(count(*) filter (where has_goals)),
        'carteira', public._k(count(*) filter (where has_holdings)),
        'aportes', public._k(count(*) filter (where has_contrib))),
      'events_30d', coalesce((
        select jsonb_object_agg(area, public._k(n)) from (
          select props->>'area' as area, count(distinct coalesce(anon_id::text, user_id::text)) n
            from public.analytics_events
           where name = 'feature_used' and at > now() - interval '30 days' and props ? 'area'
           group by 1) e), '{}'::jsonb)
    ) from s
  );
end $$;

create or replace function public.admin_simulations(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f timestamptz := p_from::timestamptz; t timestamptz := (p_to + 1)::timestamptz;
begin
  if not public.staff_has(array['marketing', 'analista']) then raise exception 'sem acesso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('day', d,
        'started', (select coalesce(sum(n), 0) from public.metrics_daily m where m.day = d and m.key = 'simulacao_iniciada'),
        'completed', (select coalesce(sum(n), 0) from public.metrics_daily m where m.day = d and m.key = 'simulacao_concluida')) order by d)
      from (select g::date as d from generate_series(p_from, p_to, interval '1 day') g) x), '[]'::jsonb),
    -- Com aceite: as telas mandam só faixas (idade, renda, aporte), nunca o valor digitado.
    'age_bands', coalesce((select jsonb_object_agg(b, public._k(n)) from (
        select props->>'age_band' b, count(*) n from public.analytics_events
         where name = 'calculator_completed' and at >= f and at < t and props ? 'age_band' group by 1) x), '{}'::jsonb),
    'income_bands', coalesce((select jsonb_object_agg(b, public._k(n)) from (
        select props->>'income_band' b, count(*) n from public.analytics_events
         where name = 'calculator_completed' and at >= f and at < t and props ? 'income_band' group by 1) x), '{}'::jsonb),
    'monthly_bands', coalesce((select jsonb_object_agg(b, public._k(n)) from (
        select props->>'monthly_band' b, count(*) n from public.analytics_events
         where name = 'calculator_completed' and at >= f and at < t and props ? 'monthly_band' group by 1) x), '{}'::jsonb),
    'by_source', coalesce((select jsonb_object_agg(src, public._k(n)) from (
        select coalesce(nullif(utm_source, ''), '(direto)') src, count(*) n from public.analytics_events
         where name = 'calculator_completed' and at >= f and at < t group by 1) x), '{}'::jsonb),
    'by_page', coalesce((select jsonb_object_agg(coalesce(path, '?'), public._k(n)) from (
        select path, count(*) n from public.analytics_events
         where name = 'calculator_completed' and at >= f and at < t group by 1) x), '{}'::jsonb)
  );
end $$;

create or replace function public.admin_marketing(p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f timestamptz := p_from::timestamptz; t timestamptz := (p_to + 1)::timestamptz;
begin
  if not public.staff_has(array['marketing', 'analista']) then raise exception 'sem acesso' using errcode = '42501'; end if;
  return jsonb_build_object(
    'campaigns', coalesce((
      select jsonb_agg(jsonb_build_object('source', src, 'campaign', camp, 'visitors', vis, 'simulations', sims,
                                          'leads', lds, 'signups', sig, 'checkouts', chk, 'subscriptions', subs) order by vis desc)
      from (
        select coalesce(nullif(e.utm_source, ''), '(direto)') src, coalesce(nullif(e.utm_campaign, ''), '—') camp,
          count(distinct e.anon_id) filter (where e.name = 'landing_view') vis,
          count(*) filter (where e.name in ('calculator_completed', 'calculator_used')) sims,
          count(*) filter (where e.name = 'lead_saved') lds,
          count(*) filter (where e.name = 'signup_completed') sig,
          count(*) filter (where e.name = 'checkout_started') chk,
          count(*) filter (where e.name = 'subscription_authorized') subs
        from public.analytics_events e where e.at >= f and e.at < t group by 1, 2) x), '[]'::jsonb),
    'leads_by_source', coalesce((select jsonb_object_agg(src, n) from (
        select coalesce(nullif(utm_source, ''), '(direto)') src, count(*) n from public.leads
         where created_at >= f and created_at < t group by 1) x), '{}'::jsonb),
    'events', coalesce((select jsonb_object_agg(name, n) from (
        select name, count(*) n from public.analytics_events where at >= f and at < t group by 1) x), '{}'::jsonb),
    'consent', jsonb_build_object(
      'aceito', (select count(*) from public.consent_log where choice = 'aceito' and at >= f and at < t),
      'recusado', (select count(*) from public.consent_log where choice = 'recusado' and at >= f and at < t))
  );
end $$;

-- Ficha do usuário: operacional, sem nenhum valor financeiro (só "usa ou não" cada área).
create or replace function public.admin_user_card(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare v jsonb;
begin
  if not public.staff_has(array['suporte', 'financeiro']) then raise exception 'sem acesso' using errcode = '42501'; end if;
  select jsonb_build_object(
    'user_id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
    'name', p.display_name,
    'mfa', exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
    'state_updated_at', st.updated_at,
    'features', case when st.data is null then null else jsonb_build_object(
      'plano', jsonb_typeof(st.data->'plan') = 'object',
      'lancamentos', coalesce(jsonb_array_length(case when jsonb_typeof(st.data->'transactions') = 'array' then st.data->'transactions' end), 0) > 0,
      'orcamento', coalesce(st.data->'budget'->'assigned', '{}'::jsonb) <> '{}'::jsonb,
      'patrimonio', coalesce(jsonb_array_length(case when jsonb_typeof(st.data->'assets') = 'array' then st.data->'assets' end), 0) > 0,
      'metas', coalesce(jsonb_array_length(case when jsonb_typeof(st.data->'goals') = 'array' then st.data->'goals' end), 0) > 0,
      'carteira', coalesce(jsonb_array_length(case when jsonb_typeof(st.data->'holdings') = 'array' then st.data->'holdings' end), 0) > 0
    ) end,
    'tickets', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'kind', t.kind, 'subject', t.subject, 'status', t.status, 'created_at', t.created_at)
                                          order by t.created_at desc) from public.support_tickets t where t.user_id = u.id), '[]'::jsonb),
    'whatsapp', exists (select 1 from public.whatsapp_links w where w.user_id = u.id),
    'push', exists (select 1 from public.push_subscriptions ps where ps.user_id = u.id)
  ) into v
  from auth.users u
  left join public.profiles p on p.id = u.id
  left join public.user_state st on st.user_id = u.id
  where u.id = p_user;
  if v is null then raise exception 'conta não encontrada'; end if;
  perform public.audit('admin_user_card', p_user::text, '{}'::jsonb);
  return v;
end $$;

create or replace function public.admin_audit_log(p_severity text default null, p_action text default null, p_limit int default 200)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public._is_super() then raise exception 'apenas super admin' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'at', a.at, 'actor_email', u.email, 'action', a.action, 'target', a.target,
                                        'severity', a.severity, 'details', a.details) order by a.at desc)
    from (select * from public.audit_log
           where (p_severity is null or severity = p_severity)
             and (p_action is null or action ilike '%' || p_action || '%')
           order by at desc limit least(greatest(p_limit, 1), 500)) a
    left join auth.users u on u.id = a.actor
  ), '[]'::jsonb);
end $$;

-- =========================================================
-- 10. Limpeza diária: incidentes resolvidos há 180 dias e contagens com mais de 25 meses
-- =========================================================
create or replace function public.purge_expired()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v jsonb := '{}'::jsonb;
  n int;
begin
  delete from public.whatsapp_link_codes where expires_at < now(); get diagnostics n = row_count; v := v || jsonb_build_object('whatsapp_link_codes', n);
  delete from public.rate_limits where window_start < now() - interval '1 day'; get diagnostics n = row_count; v := v || jsonb_build_object('rate_limits', n);
  delete from public.whatsapp_messages where received_at < now() - interval '90 days'; get diagnostics n = row_count; v := v || jsonb_build_object('whatsapp_messages', n);
  delete from public.webhook_receipts where received_at < now() - interval '30 days'; get diagnostics n = row_count; v := v || jsonb_build_object('webhook_receipts', n);
  delete from public.reminder_log where sent_at < now() - interval '180 days'; get diagnostics n = row_count; v := v || jsonb_build_object('reminder_log', n);
  delete from public.analytics_events where at < now() - interval '13 months'; get diagnostics n = row_count; v := v || jsonb_build_object('analytics_events', n);
  delete from public.leads where created_at < now() - interval '24 months'; get diagnostics n = row_count; v := v || jsonb_build_object('leads', n);
  delete from public.incidents where status = 'resolvido' and resolved_at < now() - interval '180 days'; get diagnostics n = row_count; v := v || jsonb_build_object('incidents', n);
  delete from public.metrics_daily where day < (now() - interval '25 months')::date; get diagnostics n = row_count; v := v || jsonb_build_object('metrics_daily', n);
  perform set_config('app.audit_purge', 'on', true);
  delete from public.audit_log where at < now() - interval '5 years'; get diagnostics n = row_count; v := v || jsonb_build_object('audit_log', n);
  perform set_config('app.audit_purge', 'off', true);
  return v;
end $$;

-- =========================================================
-- Permissões das funções novas
-- =========================================================
do $$
declare f text;
begin
  foreach f in array array[
    'admin_staff_list()', 'admin_staff_grant(text, text)', 'admin_staff_revoke(uuid, text)',
    'admin_tickets(text)', 'admin_ticket_reply(uuid, text)', 'admin_ticket_update(uuid, text, boolean)',
    'admin_incidents(text)', 'admin_resolve_incident(uuid)',
    'admin_leads(text, text)', 'admin_update_lead(uuid, text, text)', 'admin_log_export(text, int)',
    'admin_save_notice(uuid, text, text, boolean, timestamptz)', 'admin_list_notices()', 'admin_set_calc_settings(jsonb)',
    'admin_settings()', 'admin_set_billing_enforced(boolean)',
    'admin_overview(date, date)', 'admin_billing(date, date)', 'admin_feature_usage()', 'admin_simulations(date, date)',
    'admin_marketing(date, date)', 'admin_user_card(uuid)', 'admin_audit_log(text, text, int)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
