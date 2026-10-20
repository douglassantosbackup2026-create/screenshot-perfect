-- Fechamento do mês: os cinco passos do ritual mensal, conferidos no banco, e o XP e a conquista de fechar.
-- Espelha monthCloseSteps e demo.closeMonth (src/lib/data/demo-store.ts) e XP.month_closed (rules.ts).
-- Passos: 1. algo lançado no mês (que não seja só recorrência); 2. nada do mês sem categoria;
-- 3. o mês planejado no orçamento; 4. o mês registrado no Diário (com ou sem aporte); 5. o patrimônio do mês registrado.
-- Sem contas cadastradas, os passos 1 e 2 contam como feitos (a pessoa não usa o livro-caixa).

alter type public.xp_action add value if not exists 'month_closed';

insert into public.achievements (code, title, description, icon) values
  ('primeiro_fechamento', 'Primeiro mês fechado', 'Você fez os cinco passos do fechamento do mês.', 'calendar-check')
on conflict (code) do nothing;

create or replace function public.month_close_status(p_user uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date;
  v_next date := (date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date) + interval '1 month')::date;
  v_uses_ledger boolean;
  v_steps jsonb;
begin
  if p_user is null or (auth.uid() is not null and p_user <> auth.uid()) then raise exception 'nao autorizado'; end if;
  select exists (select 1 from public.accounts where user_id = p_user) into v_uses_ledger;
  v_steps := jsonb_build_object(
    'lancamentos', not v_uses_ledger or exists (
      select 1 from public.transactions where user_id = p_user and date >= v_month and date < v_next and source <> 'recorrente'),
    'categorias', not v_uses_ledger or (
      exists (select 1 from public.transactions where user_id = p_user and date >= v_month and date < v_next)
      and not exists (select 1 from public.transactions where user_id = p_user and date >= v_month and date < v_next
                      and transfer_id is null and category_id is null)),
    'orcamento', exists (select 1 from public.budget_assignments where user_id = p_user and month = v_month and amount > 0),
    'aporte', exists (select 1 from public.contributions where user_id = p_user and month = v_month),
    'patrimonio', exists (select 1 from public.wealth_entries where user_id = p_user and month = v_month)
  );
  return jsonb_build_object(
    'month', v_month,
    'steps', v_steps,
    'complete', not exists (select 1 from jsonb_each(v_steps) where value = 'false'::jsonb),
    'closed', exists (select 1 from public.xp_events where user_id = p_user and action_type = 'month_closed'
                      and period_key = 'M:' || to_char(v_month, 'YYYY-MM'))
  );
end $$;

create or replace function public.complete_month_close()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_status jsonb;
  v_xp int;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  v_status := public.month_close_status(v_user);
  if not (v_status ->> 'complete')::boolean then raise exception 'ainda faltam passos para fechar o mes'; end if;
  v_xp := public._award_xp(v_user, 'month_closed', 'M:' || to_char((v_status ->> 'month')::date, 'YYYY-MM'), 50, null);
  perform public._mark_week_active(v_user);
  return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', v_xp);
end $$;

-- A camada de conquistas de finanças ganha o primeiro fechamento.
create or replace function public._refresh_progress(p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_new text[];
  v_core jsonb;
begin
  with candidates(code) as (
    select 'primeiro_extrato' where exists (
      select 1 from public.transactions where user_id = p_user and source = 'importado')
    union all select 'primeiro_orcamento' where exists (
      select 1 from public.budget_assignments where user_id = p_user and amount > 0)
    union all select 'primeiro_investimento' where exists (
      select 1 from public.trades where user_id = p_user)
    union all select 'carteira_com_metas' where exists (
      select 1 from public.allocation_targets where user_id = p_user)
    union all select 'primeiro_fechamento' where exists (
      select 1 from public.xp_events where user_id = p_user and action_type = 'month_closed')
  ), inserted as (
    insert into public.user_achievements (user_id, achievement_code)
    select p_user, code from candidates
    on conflict do nothing
    returning achievement_code
  )
  select coalesce(array_agg(achievement_code), '{}') into v_new from inserted;

  v_core := public._refresh_progress_core(p_user);
  return v_core || jsonb_build_object('new_achievements', coalesce(v_core -> 'new_achievements', '[]'::jsonb) || to_jsonb(v_new));
end $$;

revoke execute on function public.month_close_status(uuid), public.complete_month_close() from public, anon;
grant execute on function public.month_close_status(uuid), public.complete_month_close() to authenticated;
revoke execute on function public._refresh_progress(uuid) from public, anon, authenticated;
