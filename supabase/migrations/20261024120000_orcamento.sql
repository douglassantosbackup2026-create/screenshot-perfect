-- Orçamento por envelopes: quanto foi distribuído em cada mês e envelope, e as metas de cada envelope.
-- Espelha src/lib/calc/budget.ts e as operações de orçamento de src/lib/data/demo-store.ts.
-- Saldos, "a distribuir" e o que as metas pedem são calculados no cliente (computeBudget, templateAmount)
-- a partir de transactions; aqui ficam só as escolhas da pessoa. Valores em centavos. Não gera XP.
-- Envelope é o id de uma categoria de gasto (uuid em texto) ou 'env-aposentadoria'.

create type public.budget_template_kind as enum ('fixo', 'ate_data', 'percentual');

create table public.budget_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  envelope text not null,
  -- Negativo devolve saldo de meses anteriores para "a distribuir".
  amount bigint not null,
  updated_at timestamptz not null default now(),
  unique (user_id, month, envelope)
);
create index on public.budget_assignments(user_id, month);

create table public.budget_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  envelope text not null,
  kind public.budget_template_kind not null,
  amount bigint check (amount is null or amount > 0),
  target bigint check (target is null or target > 0),
  deadline date check (deadline is null or extract(day from deadline) = 1),
  percent numeric(5,2) check (percent is null or (percent > 0 and percent <= 100)),
  created_at timestamptz not null default now(),
  unique (user_id, envelope),
  check (
    (kind = 'fixo' and amount is not null) or
    (kind = 'ate_data' and target is not null and deadline is not null) or
    (kind = 'percentual' and percent is not null)
  )
);

do $$
declare t text;
begin
  foreach t in array array['budget_assignments', 'budget_templates'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s: ler os proprios" on public.%I for select to authenticated using (user_id = auth.uid())', t, t);
    execute format('create policy "%s: criar os proprios" on public.%I for insert to authenticated with check (user_id = auth.uid())', t, t);
    execute format('create policy "%s: editar os proprios" on public.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('create policy "%s: excluir os proprios" on public.%I for delete to authenticated using (user_id = auth.uid())', t, t);
  end loop;
end $$;

-- O envelope precisa ser 'env-aposentadoria' ou uma categoria de gasto da própria pessoa.
create or replace function public._budget_check_envelope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.envelope = 'env-aposentadoria' then return new; end if;
  if new.envelope !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or not exists (select 1 from public.categories where id = new.envelope::uuid and user_id = new.user_id and kind = 'despesa') then
    raise exception 'envelope nao encontrado';
  end if;
  return new;
end $$;
create trigger budget_assignments_envelope before insert or update on public.budget_assignments
  for each row execute function public._budget_check_envelope();
create trigger budget_templates_envelope before insert or update on public.budget_templates
  for each row execute function public._budget_check_envelope();

-- Excluir a categoria tira o envelope do orçamento (espelho de deleteCategory).
create or replace function public._budget_drop_category()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.budget_assignments where user_id = old.user_id and envelope = old.id::text;
  delete from public.budget_templates where user_id = old.user_id and envelope = old.id::text;
  return old;
end $$;
create trigger categories_drop_envelope after delete on public.categories
  for each row execute function public._budget_drop_category();

-- Mover dinheiro entre envelopes no mesmo mês, de uma vez (espelho de moveBudget).
create or replace function public.move_budget(p_month date, p_from text, p_to text, p_amount bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_month date := date_trunc('month', p_month)::date;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'valor invalido'; end if;
  if p_from = p_to then raise exception 'envelopes iguais'; end if;
  insert into public.budget_assignments (user_id, month, envelope, amount) values (v_user, v_month, p_from, -p_amount)
    on conflict (user_id, month, envelope) do update set amount = budget_assignments.amount - p_amount, updated_at = now();
  insert into public.budget_assignments (user_id, month, envelope, amount) values (v_user, v_month, p_to, p_amount)
    on conflict (user_id, month, envelope) do update set amount = budget_assignments.amount + p_amount, updated_at = now();
end $$;

-- ---------- Exportação inclui o orçamento ----------
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
    'budget_assignments', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.budget_assignments x where x.user_id = auth.uid()),
    'budget_templates', (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.budget_templates x where x.user_id = auth.uid()),
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
grant select, insert, update, delete on public.budget_assignments, public.budget_templates to authenticated;
grant all on public.budget_assignments, public.budget_templates to service_role;
revoke execute on function public.move_budget(date, text, text, bigint) from public, anon;
revoke execute on function public._budget_check_envelope(), public._budget_drop_category() from public, anon, authenticated;
grant execute on function public.move_budget(date, text, text, bigint) to authenticated;
