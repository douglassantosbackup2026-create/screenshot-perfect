-- Endurecimento de segurança, parte 2: papéis com MFA, XP sem brechas, referências do livro-caixa,
-- push só para serviços de push, recibos de webhook, auditoria imutável, limite de taxa, leads sem
-- enumeração, retenção de dados. Tabelas novas: RLS ligado, sem policies e sem grants a anon/authenticated
-- (o Supabase dá grants padrão a tabelas novas; aqui são revogados).

-- =========================================================
-- Papéis
-- =========================================================

-- has_role continua usável nas policies, mas só responde sobre a própria conta (ou sem sessão: service_role).
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or _user_id = auth.uid())
    and exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- "Tem o papel de admin?", sem exigir MFA: a tela usa para mandar o admin ativar o segundo fator.
create or replace function public.has_admin_role()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
$$;
revoke execute on function public.has_admin_role() from public, anon;
grant execute on function public.has_admin_role() to authenticated;

-- Admin de verdade só com sessão verificada pelo segundo fator (aal2).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role() and coalesce(auth.jwt()->>'aal', '') = 'aal2'
$$;

-- Conteúdo: rascunhos e escrita exigem admin com MFA.
alter policy "programas: ler publicados" on public.programs using (status = 'publicada' or public.is_admin());
alter policy "licoes: ler publicadas" on public.lessons using (status = 'publicada' or public.is_admin());
alter policy "missoes: ler publicadas" on public.weekly_missions using (status = 'publicada' or public.is_admin());
alter policy "desafios: ler publicados" on public.challenges using (status = 'publicada' or public.is_admin());
alter policy "perguntas: so admin le" on public.lesson_questions using (public.is_admin());
alter policy "programas: admin escreve" on public.programs using (public.is_admin()) with check (public.is_admin());
alter policy "licoes: admin escreve" on public.lessons using (public.is_admin()) with check (public.is_admin());
alter policy "perguntas: admin escreve" on public.lesson_questions using (public.is_admin()) with check (public.is_admin());
alter policy "missoes: admin escreve" on public.weekly_missions using (public.is_admin()) with check (public.is_admin());
alter policy "desafios: admin escreve" on public.challenges using (public.is_admin()) with check (public.is_admin());

-- Gravar o próprio estado: o admin continua liberado mesmo antes de ativar o MFA (são dados dele).
create or replace function public.has_active_entitlement()
returns boolean language sql stable security definer set search_path = public as $$
  select not coalesce((select billing_enforced from public.app_settings), false)
    or public.has_admin_role()
    or exists (select 1 from public.entitlements where user_id = auth.uid() and valid_until > now())
$$;

-- Quem ativou o segundo fator (TOTP verificado) só lê e grava os próprios dados com sessão aal2:
-- a senha vazada sozinha não abre a conta, nem chamando a API direto.
create or replace function public._mfa_ok()
returns boolean language sql stable security definer set search_path = public, auth as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2'
    or not exists (select 1 from auth.mfa_factors where user_id = auth.uid() and status = 'verified')
$$;
revoke execute on function public._mfa_ok() from public, anon;
grant execute on function public._mfa_ok() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'user_state', 'profiles', 'retirement_plans', 'contributions', 'wealth_entries', 'goals', 'assets',
    'accounts', 'categories', 'recurring_rules', 'transactions', 'category_rules', 'budget_assignments', 'budget_templates',
    'holdings', 'trades', 'whatsapp_links', 'push_subscriptions', 'bank_connections', 'subscriptions', 'payments', 'entitlements'
  ] loop
    execute format('create policy "%s: segundo fator quando ativado" on public.%I as restrictive for all to authenticated using (public._mfa_ok()) with check (public._mfa_ok())', t, t);
  end loop;
end $$;

-- Login recente (método de autenticação nos últimos p_seconds), para ações irreversíveis.
create or replace function public._recent_auth(p_seconds int)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) m
    where (m->>'timestamp') ~ '^[0-9]{1,12}$'
      and (m->>'timestamp')::bigint >= extract(epoch from now())::bigint - p_seconds
  )
$$;
revoke execute on function public._recent_auth(int) from public, anon, authenticated;

-- =========================================================
-- Auditoria imutável
-- =========================================================
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid, -- quem estava conectado; nulo quando foi o servidor
  action text not null check (char_length(action) between 1 and 60),
  target text check (char_length(target) <= 200),
  severity text not null default 'info' check (severity in ('info', 'warning', 'high')),
  details jsonb not null default '{}'::jsonb check (pg_column_size(details) <= 8192)
);
create index on public.audit_log (at);
create index on public.audit_log (severity, at) where severity <> 'info';
alter table public.audit_log enable row level security;
revoke all on public.audit_log from public, anon, authenticated;
grant select, insert on public.audit_log to service_role;

-- Só inserção. Apagar só o que passou do prazo de retenção (5 anos), e só por purge_expired().
create or replace function public._audit_immutable()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' and old.at < now() - interval '5 years' and current_setting('app.audit_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'audit_log é somente inserção' using errcode = '42501';
end $$;
create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function public._audit_immutable();
create or replace function public._audit_no_truncate()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'audit_log é somente inserção' using errcode = '42501';
end $$;
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function public._audit_no_truncate();

create or replace function public.audit(p_action text, p_target text default null, p_details jsonb default '{}'::jsonb, p_severity text default 'info')
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_log (actor, action, target, severity, details)
  values (
    auth.uid(),
    left(p_action, 60),
    left(p_target, 200),
    case when p_severity in ('info', 'warning', 'high') then p_severity else 'info' end,
    case when pg_column_size(coalesce(p_details, '{}'::jsonb)) <= 8192 then coalesce(p_details, '{}'::jsonb)
         else jsonb_build_object('truncated', true) end
  );
end $$;
revoke execute on function public.audit(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.audit(text, text, jsonb, text) to service_role;

-- Mudanças de conteúdo, papéis e configurações ficam registradas, venham de onde vierem.
create or replace function public._audit_row_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  perform public.audit(
    tg_table_name || '_' || lower(tg_op),
    coalesce(v_row->>'id', v_row->>'user_id', v_row->>'slug'),
    jsonb_build_object('table', tg_table_name, 'op', tg_op, 'status', v_row->>'status', 'role', v_row->>'role'),
    case when tg_table_name in ('user_roles', 'app_settings') then 'high' else 'info' end
  );
  return null;
end $$;
revoke execute on function public._audit_row_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['programs', 'lessons', 'lesson_questions', 'weekly_missions', 'challenges', 'user_roles', 'app_settings'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public._audit_row_change()', t || '_audit', t);
  end loop;
end $$;

-- =========================================================
-- Limite de taxa (janela fixa)
-- =========================================================
create table public.rate_limits (
  key text not null check (char_length(key) <= 200),
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;
grant all on public.rate_limits to service_role;

-- true = pode seguir; false = passou do limite nesta janela.
create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into public.rate_limits as r (key, window_start, count) values (left(p_key, 200), v_start, 1)
  on conflict (key, window_start) do update set count = r.count + 1
  returning r.count into v_count;
  return v_count <= p_limit;
end $$;
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

-- IP de quem chamou a API (cabeçalhos repassados pelo PostgREST). Vazio fora de uma requisição.
create or replace function public._client_ip()
returns text language sql stable set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::jsonb->>'cf-connecting-ip',
    btrim(split_part(nullif(current_setting('request.headers', true), '')::jsonb->>'x-forwarded-for', ',', 1)),
    ''
  )
$$;
revoke execute on function public._client_ip() from public, anon, authenticated;

-- =========================================================
-- XP sem brechas
-- =========================================================

-- Planejar o mês: só o atual e o seguinte (antes, qualquer mês futuro rendia XP).
create or replace function public._budget_award()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date;
begin
  if new.amount > 0 and new.month >= v_month and new.month <= (v_month + interval '1 month')::date then
    perform public._award_xp(new.user_id, 'budget_planned', 'M:' || to_char(new.month, 'YYYY-MM'), 20, null);
    perform public._mark_week_active(new.user_id);
  end if;
  return null;
end $$;

-- Concluir meta: no máximo 3 com XP por mês, como criar (antes, criar e concluir rendia XP sem fim).
create or replace function public.complete_goal(p_goal uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_month_start timestamptz := date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v_xp int := 0;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  update public.goals set completed_at = now()
  where id = p_goal and user_id = v_user and completed_at is null;
  if found then
    if (select count(*) from public.xp_events
        where user_id = v_user and action_type = 'goal_completed' and created_at >= v_month_start) < 3 then
      v_xp := public._award_xp(v_user, 'goal_completed', 'G:' || p_goal::text, 60, p_goal);
    end if;
    perform public._mark_week_active(v_user);
  end if;
  return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', v_xp);
end $$;

-- Missão do dia: a mesma pergunta não conta duas vezes ("1-1" e "01-1").
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
    if jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object'
       or exists (select 1 from jsonb_object_keys(coalesce(p_answers, '{}'::jsonb)) k(key) where k.key !~ '^[0-9]{1,3}-[0-9]{1,2}$')
       or exists (
         select 1 from jsonb_object_keys(coalesce(p_answers, '{}'::jsonb)) k(key)
         group by split_part(k.key, '-', 1)::int, split_part(k.key, '-', 2)::int having count(*) > 1
       ) then
      raise exception 'respostas invalidas';
    end if;
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

-- =========================================================
-- Livro-caixa: toda referência é da mesma pessoa; valores com limite de sanidade
-- =========================================================
create or replace function public._ledger_check_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name in ('transactions', 'recurring_rules') then
    if not exists (select 1 from public.accounts where id = new.account_id and user_id = new.user_id) then
      raise exception 'conta nao encontrada';
    end if;
  end if;
  if new.category_id is not null
     and not exists (select 1 from public.categories where id = new.category_id and user_id = new.user_id) then
    raise exception 'categoria nao encontrada';
  end if;
  if tg_table_name = 'transactions' then
    -- A outra perna pode ainda não existir (FK adiada), mas nunca pode ser de outra pessoa.
    if new.transfer_id is not null
       and exists (select 1 from public.transactions where id = new.transfer_id and user_id <> new.user_id) then
      raise exception 'transferencia nao encontrada';
    end if;
    if new.recurring_id is not null
       and not exists (select 1 from public.recurring_rules where id = new.recurring_id and user_id = new.user_id) then
      raise exception 'recorrencia nao encontrada';
    end if;
    if new.contribution_id is not null
       and not exists (select 1 from public.contributions where id = new.contribution_id and user_id = new.user_id) then
      raise exception 'aporte nao encontrado';
    end if;
  end if;
  return new;
end $$;

-- R$ 100 bilhões em centavos: barra lixo e estouro, sem atrapalhar ninguém.
alter table public.transactions add constraint transactions_amount_limite check (abs(amount) <= 10000000000000) not valid;
alter table public.recurring_rules add constraint recurring_rules_amount_limite check (abs(amount) <= 10000000000000) not valid;
alter table public.accounts add constraint accounts_opening_balance_limite check (abs(opening_balance) <= 10000000000000) not valid;

-- Limites configuráveis (uma linha em app_settings).
alter table public.app_settings
  add column if not exists max_import_rows int not null default 5000 check (max_import_rows between 1 and 50000);

create or replace function public.import_transactions(p_account uuid, p_fresh jsonb, p_matched jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_max int := coalesce((select max_import_rows from public.app_settings), 5000);
  v_added int := 0;
  v_matched int := 0;
  v_xp int := 0;
  v_row jsonb;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if not exists (select 1 from public.accounts where id = p_account and user_id = v_user) then
    raise exception 'conta nao encontrada';
  end if;
  if jsonb_typeof(p_fresh) <> 'array' or jsonb_typeof(coalesce(p_matched, '[]'::jsonb)) <> 'array' then
    raise exception 'extrato invalido';
  end if;
  if jsonb_array_length(p_fresh) > v_max or jsonb_array_length(coalesce(p_matched, '[]'::jsonb)) > v_max then
    raise exception 'extrato grande demais';
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_matched, '[]'::jsonb)) loop
    update public.transactions set imported_id = coalesce(v_row->>'importedId', imported_id)
      where id = (v_row->>'existingId')::uuid and user_id = v_user and account_id = p_account and source <> 'importado';
    if found then v_matched := v_matched + 1; end if;
  end loop;

  for v_row in select * from jsonb_array_elements(p_fresh) loop
    insert into public.transactions (user_id, account_id, date, amount, payee, category_id, note, imported_id, source)
    values (v_user, p_account, (v_row->>'date')::date, (v_row->>'amount')::bigint, left(btrim(v_row->>'payee'), 120),
            nullif(v_row->>'categoryId', '')::uuid, left(v_row->>'memo', 280), v_row->>'importedId', 'importado')
    on conflict (account_id, imported_id) where imported_id is not null do nothing;
    if found then v_added := v_added + 1; end if;
  end loop;

  if v_added > 0 then
    v_xp := public._award_xp(v_user, 'statement_imported',
      'M:' || to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM'), 20, null);
    perform public._mark_week_active(v_user);
  end if;
  return public._refresh_progress(v_user) || jsonb_build_object('added', v_added, 'matched', v_matched, 'xp_awarded', v_xp);
end $$;

-- =========================================================
-- Push: o servidor só chama serviços de push conhecidos (evita SSRF pelo endpoint gravado pelo cliente)
-- =========================================================
delete from public.push_subscriptions
where endpoint !~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com)/';
alter table public.push_subscriptions add constraint push_endpoint_servico_conhecido
  check (endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com)/');

-- =========================================================
-- Webhooks: cada notificação é processada uma vez só
-- =========================================================
create table public.webhook_receipts (
  provider text not null check (provider in ('mercadopago', 'openfinance')),
  request_id text not null check (char_length(request_id) between 1 and 200),
  received_at timestamptz not null default now(),
  primary key (provider, request_id)
);
create index on public.webhook_receipts (received_at);
alter table public.webhook_receipts enable row level security;
revoke all on public.webhook_receipts from public, anon, authenticated;
grant all on public.webhook_receipts to service_role;

-- =========================================================
-- Cobrança: auditoria e status da assinatura em ordem
-- =========================================================
create or replace function public.credit_payment(p_id text, p_user uuid, p_plan text, p_period text, p_amount_cents bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_days int := case p_period when 'anual' then 366 else 31 end;
  v_until timestamptz;
begin
  insert into public.payments (id, user_id, plan, period, amount_cents, status)
  values (p_id, p_user, p_plan, p_period, p_amount_cents, 'approved')
  on conflict (id) do nothing;
  if not found then
    return jsonb_build_object('credited', false, 'reason', 'ja creditado');
  end if;
  insert into public.entitlements (user_id, plan, valid_until)
  values (p_user, p_plan, now() + make_interval(days => v_days))
  on conflict (user_id) do update set
    plan = case when excluded.plan = 'pro' or public.entitlements.valid_until < now() then excluded.plan else public.entitlements.plan end,
    valid_until = greatest(public.entitlements.valid_until, now()) + make_interval(days => v_days),
    updated_at = now()
  returning valid_until into v_until;
  perform public.audit('payment_credited', p_user::text,
    jsonb_build_object('payment', p_id, 'plan', p_plan, 'period', p_period, 'amount_cents', p_amount_cents, 'valid_until', v_until));
  return jsonb_build_object('credited', true, 'valid_until', v_until);
end $$;

alter table public.subscriptions add column if not exists last_event_at timestamptz;

-- Grava o status da assinatura só se a informação for mais nova que a gravada (notificações chegam fora de ordem).
create or replace function public.apply_subscription_status(
  p_user uuid, p_preapproval text, p_plan text, p_period text, p_status text, p_event_at timestamptz, p_source text default 'webhook')
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_old text;
begin
  select status into v_old from public.subscriptions where user_id = p_user;
  insert into public.subscriptions as s (user_id, preapproval_id, plan, period, status, updated_at, last_event_at)
  values (p_user, p_preapproval, p_plan, p_period, p_status, now(), p_event_at)
  on conflict (user_id) do update set
    preapproval_id = excluded.preapproval_id,
    plan = excluded.plan,
    period = excluded.period,
    status = excluded.status,
    updated_at = now(),
    last_event_at = excluded.last_event_at
  where s.last_event_at is null or excluded.last_event_at >= s.last_event_at;
  if not found then return false; end if;
  if v_old is distinct from p_status then
    perform public.audit('subscription_status', p_user::text,
      jsonb_build_object('from', v_old, 'to', p_status, 'preapproval', p_preapproval, 'source', p_source));
  end if;
  return true;
end $$;
revoke execute on function public.apply_subscription_status(uuid, text, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.apply_subscription_status(uuid, text, text, text, text, timestamptz, text) to service_role;

-- =========================================================
-- Conta
-- =========================================================
-- Excluir a conta exige login nos últimos 10 minutos; leva junto o lead do mesmo e-mail (LGPD).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_user uuid := auth.uid();
  v_email text;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if not public._recent_auth(600) or not public._mfa_ok() then
    raise exception 'confirme sua senha para excluir a conta' using errcode = '42501', hint = 'reauth';
  end if;
  select email into v_email from auth.users where id = v_user;
  if v_email is not null then delete from public.leads where lower(btrim(email)) = lower(btrim(v_email)); end if;
  perform public.audit('account_deleted', v_user::text, '{}'::jsonb, 'warning');
  delete from auth.users where id = v_user;
end $$;

-- =========================================================
-- Leads: um endpoint que não revela se o e-mail já existe, com limite por IP
-- =========================================================
create or replace function public.submit_lead(
  p_email text, p_source text, p_simulation jsonb default null,
  p_utm_source text default null, p_utm_medium text default null, p_utm_campaign text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.hit_rate_limit('lead:ip:' || public._client_ip(), 10, 3600) then
    raise exception 'muitas tentativas, tente mais tarde' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  insert into public.leads (email, consent_marketing, source, simulation, utm_source, utm_medium, utm_campaign)
  values (
    btrim(p_email), true, left(coalesce(p_source, 'calculadora'), 40),
    case when p_simulation is not null and jsonb_typeof(p_simulation) = 'object' and pg_column_size(p_simulation) <= 4096 then p_simulation end,
    left(p_utm_source, 80), left(p_utm_medium, 80), left(p_utm_campaign, 80)
  )
  on conflict ((lower(btrim(email)))) do nothing;
end $$;
revoke execute on function public.submit_lead(text, text, jsonb, text, text, text) from public;
grant execute on function public.submit_lead(text, text, jsonb, text, text, text) to anon, authenticated;
revoke insert on public.leads from anon, authenticated;

-- Analytics: além do limite por navegador, um limite por IP (trocar o id do navegador não fura mais).
create or replace function public.track_event(p_anon uuid, p_name text, p_path text default null, p_utm jsonb default '{}'::jsonb, p_props jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_anon is null then return; end if;
  if p_name not in ('landing_view', 'calculator_used', 'lead_saved', 'signup_completed', 'checkout_started') then
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
-- Back-office
-- =========================================================
-- Fontes de lição só com https (um "javascript:" viraria XSS quando a lição vier do banco).
create or replace function public.lesson_publish_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (
    select 1 from jsonb_array_elements(case when jsonb_typeof(new.sources) = 'array' then new.sources else '[]'::jsonb end) s
    where coalesce(btrim(s->>'url'), '') <> '' and btrim(s->>'url') !~* '^https://[^\s/]+'
  ) then
    raise exception 'fontes precisam de link https://' using errcode = 'check_violation';
  end if;
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

-- Busca de pessoas: curingas do texto viram literais, e cada busca fica auditada (acesso a dados pessoais).
-- Deixa de ser "stable" porque grava a auditoria.
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
language plpgsql volatile security definer set search_path = public, auth as $$
declare
  v_q text := left(btrim(coalesce(p_query, '')), 254);
  v_like text;
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  if char_length(v_q) < 3 then return; end if;
  v_like := replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_');
  perform public.audit('admin_find_users', null, jsonb_build_object('query', v_q));

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
  where u.email ilike '%' || v_like || '%' escape '\' or u.id::text = v_q
  order by u.created_at desc
  limit 20;
end;
$$;

-- Funil: no máximo um ano por consulta.
create or replace function public.admin_funnel(p_from date, p_to date)
returns table (step text, source text, people bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'apenas admin' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'periodo invalido (maximo de 366 dias)' using errcode = '22023';
  end if;
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

-- =========================================================
-- WhatsApp: código de conexão com 8 caracteres
-- =========================================================
alter table public.whatsapp_link_codes drop constraint if exists whatsapp_link_codes_code_check;
alter table public.whatsapp_link_codes add constraint whatsapp_link_codes_code_check check (code ~ '^[A-Z0-9]{8}$') not valid;

-- =========================================================
-- Retenção e descarte (chamado todo dia pelo /api/cron/lembretes)
-- =========================================================
-- Prazos: códigos vencidos e limites de taxa, na hora; mensagens do WhatsApp, 90 dias; recibos de webhook,
-- 30 dias; lembretes enviados, 180 dias; eventos de analytics, 13 meses; leads, 24 meses;
-- auditoria, 5 anos. consent_log fica enquanto a conta existir (prova do consentimento).
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
  perform set_config('app.audit_purge', 'on', true);
  delete from public.audit_log where at < now() - interval '5 years'; get diagnostics n = row_count; v := v || jsonb_build_object('audit_log', n);
  perform set_config('app.audit_purge', 'off', true);
  return v;
end $$;
revoke execute on function public.purge_expired() from public, anon, authenticated;
grant execute on function public.purge_expired() to service_role;

-- Funções internas novas: nada para o cliente.
revoke execute on function public._audit_immutable(), public._audit_no_truncate() from public, anon, authenticated;
