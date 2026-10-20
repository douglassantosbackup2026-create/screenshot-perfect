-- Livro-caixa: contas, categorias, lançamentos, recorrências e regras de categoria.
-- Espelha src/lib/calc/{ledger,recurring,categorize,import}.ts e as operações de src/lib/data/demo-store.ts.
-- Valores em centavos (bigint), com sinal: entrada positiva, saída negativa.
-- São dados da própria pessoa e não geram XP: leitura e escrita direta com RLS.
-- O que precisa ser atômico passa por funções: transferência (duas pernas + aporte), importação e recorrências.
-- As regras de categoria são aplicadas no cliente (applyRules) antes de gravar, como no modo demonstração.

create type public.account_kind as enum ('corrente', 'poupanca', 'carteira', 'cartao', 'investimento', 'previdencia', 'emprestimo');
create type public.category_kind as enum ('receita', 'despesa');
create type public.tx_source as enum ('manual', 'importado', 'recorrente');
create type public.recurrence_frequency as enum ('semanal', 'mensal', 'anual');
create type public.weekend_rule as enum ('manter', 'antes', 'depois');
create type public.rule_op as enum ('contem', 'igual');

-- ---------- Contas ----------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind public.account_kind not null,
  opening_balance bigint not null default 0,
  created_at timestamptz not null default now()
);
create index on public.accounts(user_id);

-- ---------- Categorias ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  kind public.category_kind not null,
  created_at timestamptz not null default now()
);
create unique index categories_user_kind_name on public.categories(user_id, kind, lower(btrim(name)));

-- ---------- Recorrências ----------
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  amount bigint not null check (amount <> 0),
  payee text not null check (char_length(btrim(payee)) between 1 and 120),
  category_id uuid references public.categories(id) on delete set null,
  note text check (note is null or char_length(note) <= 280),
  start_date date not null,
  frequency public.recurrence_frequency not null,
  every int not null default 1 check (every between 1 and 52),
  end_date date check (end_date is null or end_date >= start_date),
  weekend public.weekend_rule not null default 'manter',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.recurring_rules(user_id);

-- ---------- Lançamentos ----------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  date date not null,
  amount bigint not null check (amount <> 0),
  payee text not null check (char_length(btrim(payee)) between 1 and 120),
  category_id uuid references public.categories(id) on delete set null,
  note text check (note is null or char_length(note) <= 280),
  -- Outra perna da transferência. Transferências não têm categoria.
  transfer_id uuid references public.transactions(id) on delete cascade deferrable initially deferred,
  imported_id text check (imported_id is null or char_length(imported_id) <= 255),
  source public.tx_source not null default 'manual',
  recurring_id uuid references public.recurring_rules(id) on delete set null,
  occurrence_date date,
  contribution_id uuid references public.contributions(id) on delete set null,
  created_at timestamptz not null default now(),
  check (transfer_id is null or category_id is null)
);
create index on public.transactions(user_id, date);
create index on public.transactions(account_id);
-- O mesmo identificador do banco não entra duas vezes na mesma conta.
create unique index transactions_account_imported on public.transactions(account_id, imported_id) where imported_id is not null;
-- Gerar as recorrências de novo não duplica: uma por regra e data nominal.
create unique index transactions_recurring_occurrence on public.transactions(recurring_id, occurrence_date) where recurring_id is not null;

-- ---------- Regras de categoria ----------
create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  op public.rule_op not null,
  value text not null check (char_length(btrim(value)) between 1 and 80),
  category_id uuid not null references public.categories(id) on delete cascade,
  rename_to text check (rename_to is null or char_length(btrim(rename_to)) between 1 and 120),
  created_at timestamptz not null default now()
);
create index on public.category_rules(user_id);

-- ---------- RLS: cada pessoa lê e escreve só o que é seu ----------
do $$
declare t text;
begin
  foreach t in array array['accounts', 'categories', 'recurring_rules', 'transactions', 'category_rules'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: ler os proprios" on public.%I for select to authenticated using (user_id = auth.uid())', t, t);
    execute format('create policy "%s: criar os proprios" on public.%I for insert to authenticated with check (user_id = auth.uid())', t, t);
    execute format('create policy "%s: editar os proprios" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('create policy "%s: excluir os proprios" on public.%I for delete to authenticated using (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- Referências entre tabelas também precisam ser da mesma pessoa.
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
  return new;
end $$;
create trigger transactions_owner before insert or update on public.transactions
  for each row execute function public._ledger_check_owner();
create trigger recurring_rules_owner before insert or update on public.recurring_rules
  for each row execute function public._ledger_check_owner();
create trigger category_rules_owner before insert or update on public.category_rules
  for each row execute function public._ledger_check_owner();

-- Numa transferência, data, valor e nota mudam nas duas pernas (espelho de updateTransaction).
create or replace function public._sync_transfer()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or new.transfer_id is null then return new; end if;
  if sign(new.amount) <> sign(old.amount) then
    raise exception 'na transferencia, troque a direcao excluindo e lancando de novo';
  end if;
  update public.transactions
    set date = new.date, amount = -new.amount, note = new.note
    where id = new.transfer_id and user_id = new.user_id;
  return new;
end $$;
create trigger transactions_sync_transfer after update of date, amount, note on public.transactions
  for each row execute function public._sync_transfer();

-- ---------- Categorias iniciais (as mesmas de DEFAULT_CATEGORIES) ----------
create or replace function public.seed_default_categories()
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if exists (select 1 from public.categories where user_id = v_user) then return; end if;
  insert into public.categories (user_id, name, kind) values
    (v_user, 'Renda do trabalho', 'receita'), (v_user, 'Outras receitas', 'receita'),
    (v_user, 'Moradia', 'despesa'), (v_user, 'Mercado', 'despesa'), (v_user, 'Transporte', 'despesa'),
    (v_user, 'Saúde', 'despesa'), (v_user, 'Educação', 'despesa'), (v_user, 'Restaurantes', 'despesa'),
    (v_user, 'Lazer', 'despesa'), (v_user, 'Assinaturas', 'despesa'), (v_user, 'Impostos e taxas', 'despesa'),
    (v_user, 'Outros gastos', 'despesa');
end $$;

-- ---------- Transferência (espelho de addTransfer) ----------
create or replace function public.create_transfer(
  p_from uuid, p_to uuid, p_date date, p_amount bigint, p_note text default null,
  p_contribution public.contribution_destination default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_from public.accounts;
  v_to public.accounts;
  v_out uuid := gen_random_uuid();
  v_in uuid := gen_random_uuid();
  v_contribution uuid;
  v_progress jsonb := '{}'::jsonb;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if p_from = p_to then raise exception 'contas iguais'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'valor invalido'; end if;
  select * into v_from from public.accounts where id = p_from and user_id = v_user;
  select * into v_to from public.accounts where id = p_to and user_id = v_user;
  if v_from.id is null or v_to.id is null then raise exception 'conta nao encontrada'; end if;

  if p_contribution is not null then
    if v_to.kind not in ('investimento', 'previdencia') then
      raise exception 'so transferencias para previdencia ou investimentos contam como aporte';
    end if;
    -- O mesmo registro do Diário, com o XP de sempre (log_contribution).
    v_progress := public.log_contribution(p_date, true, p_amount / 100.0, p_contribution, p_note);
    select id into v_contribution from public.contributions
      where user_id = v_user order by created_at desc limit 1;
  end if;

  insert into public.transactions (id, user_id, account_id, date, amount, payee, note, transfer_id, contribution_id) values
    (v_out, v_user, p_from, p_date, -p_amount, 'Transferência para ' || v_to.name, p_note, v_in, v_contribution),
    (v_in, v_user, p_to, p_date, p_amount, 'Transferência de ' || v_from.name, p_note, v_out, null);
  return v_progress || jsonb_build_object('out_id', v_out, 'in_id', v_in);
end $$;

-- Excluir uma perna exclui a outra: cada perna aponta para a outra com transfer_id on delete cascade.

-- ---------- Importação (espelho de importTransactions) ----------
-- O cliente envia as linhas já separadas por dedupe(): `fresh` (novas, já categorizadas) e `matched`
-- (lançamentos manuais que passam a carregar o identificador do banco). O índice único barra repetições.
create or replace function public.import_transactions(p_account uuid, p_fresh jsonb, p_matched jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_added int := 0;
  v_matched int := 0;
  v_row jsonb;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if not exists (select 1 from public.accounts where id = p_account and user_id = v_user) then
    raise exception 'conta nao encontrada';
  end if;
  if jsonb_array_length(p_fresh) > 5000 then raise exception 'extrato grande demais'; end if;

  for v_row in select * from jsonb_array_elements(p_matched) loop
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
  return jsonb_build_object('added', v_added, 'matched', v_matched);
end $$;

-- ---------- Recorrências (espelho de materializeRecurring / src/lib/calc/recurring.ts) ----------
-- A k-ésima data nominal parte sempre do início; `date + interval` já leva o dia 31 ao último dia do mês.
create or replace function public._nominal_date(p_rule public.recurring_rules, k int)
returns date language sql immutable as $$
  select case p_rule.frequency
    when 'semanal' then p_rule.start_date + (7 * p_rule.every * k)
    when 'mensal' then (p_rule.start_date + make_interval(months => p_rule.every * k))::date
    else (p_rule.start_date + make_interval(years => p_rule.every * k))::date
  end
$$;

create or replace function public._adjust_weekend(p_date date, p_rule public.weekend_rule)
returns date language sql immutable as $$
  select case
    when p_rule = 'manter' then p_date
    when extract(isodow from p_date) = 6 then p_date + case when p_rule = 'antes' then -1 else 2 end
    when extract(isodow from p_date) = 7 then p_date + case when p_rule = 'antes' then -2 else 1 end
    else p_date
  end
$$;

create or replace function public.materialize_recurring()
returns int language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_rule public.recurring_rules;
  v_nominal date;
  v_date date;
  v_added int := 0;
  k int;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  for v_rule in select * from public.recurring_rules where user_id = v_user and active loop
    for k in 0..999 loop
      v_nominal := public._nominal_date(v_rule, k);
      -- Uma ocorrência de sábado pode ser antecipada para sexta: olha dois dias adiante.
      exit when v_nominal > v_today + 2 or (v_rule.end_date is not null and v_nominal > v_rule.end_date);
      v_date := public._adjust_weekend(v_nominal, v_rule.weekend);
      continue when v_date > v_today;
      insert into public.transactions (user_id, account_id, date, amount, payee, category_id, note, source, recurring_id, occurrence_date)
      values (v_user, v_rule.account_id, v_date, v_rule.amount, v_rule.payee, v_rule.category_id, v_rule.note, 'recorrente', v_rule.id, v_nominal)
      on conflict (recurring_id, occurrence_date) where recurring_id is not null do nothing;
      if found then v_added := v_added + 1; end if;
    end loop;
  end loop;
  return v_added;
end $$;

-- ---------- Exportação inclui o livro-caixa ----------
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
    'accounts', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.accounts x where x.user_id = auth.uid()),
    'categories', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.categories x where x.user_id = auth.uid()),
    'transactions', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.transactions x where x.user_id = auth.uid()),
    'recurring_rules', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.recurring_rules x where x.user_id = auth.uid()),
    'category_rules', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.category_rules x where x.user_id = auth.uid()),
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
grant select, insert, update, delete on public.accounts, public.categories, public.recurring_rules, public.transactions, public.category_rules to authenticated;
grant all on public.accounts, public.categories, public.recurring_rules, public.transactions, public.category_rules to service_role;

revoke execute on function public.seed_default_categories() from public, anon;
revoke execute on function public.create_transfer(uuid, uuid, date, bigint, text, public.contribution_destination) from public, anon;
revoke execute on function public.import_transactions(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.materialize_recurring() from public, anon;
revoke execute on function public._ledger_check_owner(), public._sync_transfer() from public, anon, authenticated;
grant execute on function public.seed_default_categories(), public.create_transfer(uuid, uuid, date, bigint, text, public.contribution_destination),
  public.import_transactions(uuid, jsonb, jsonb), public.materialize_recurring() to authenticated;
