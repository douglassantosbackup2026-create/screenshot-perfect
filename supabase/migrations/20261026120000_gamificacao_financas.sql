-- XP e conquistas das funções de finanças: importar extrato, planejar o mês no orçamento,
-- registrar investimentos e definir metas de alocação.
-- Espelha src/lib/gamification/rules.ts (XP, ACHIEVEMENTS, eligibleAchievements) e demo-store.ts.
-- Como no resto, o XP vem do hábito (uma vez por mês), nunca do valor.

alter type public.xp_action add value if not exists 'statement_imported';
alter type public.xp_action add value if not exists 'budget_planned';
alter type public.xp_action add value if not exists 'investment_logged';

insert into public.achievements (code, title, description, icon) values
  ('primeiro_extrato', 'Extrato importado', 'Você importou um extrato do banco para o Diário.', 'file-up'),
  ('primeiro_orcamento', 'Mês planejado', 'Você deu um destino ao dinheiro do mês no orçamento.', 'wallet'),
  ('primeiro_investimento', 'Primeiro investimento', 'Você registrou uma operação de investimento.', 'line-chart'),
  ('carteira_com_metas', 'Carteira com metas', 'Você definiu quanto quer em cada classe de investimento.', 'pie-chart')
on conflict (code) do nothing;

-- ---------- Conquistas novas, por cima do cálculo de progresso existente ----------
-- O cálculo original continua igual, com outro nome; este acrescenta as conquistas novas e junta a lista.
alter function public._refresh_progress(uuid) rename to _refresh_progress_core;

create function public._refresh_progress(p_user uuid)
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

-- ---------- Importar extrato: XP uma vez por mês quando entra algo novo ----------
create or replace function public.import_transactions(p_account uuid, p_fresh jsonb, p_matched jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_added int := 0;
  v_matched int := 0;
  v_xp int := 0;
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

  if v_added > 0 then
    v_xp := public._award_xp(v_user, 'statement_imported',
      'M:' || to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM'), 20, null);
    perform public._mark_week_active(v_user);
  end if;
  return public._refresh_progress(v_user) || jsonb_build_object('added', v_added, 'matched', v_matched, 'xp_awarded', v_xp);
end $$;

-- ---------- Planejar o mês: XP uma vez por mês planejado, só o atual ou à frente ----------
create or replace function public._budget_award()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.amount > 0 and new.month >= date_trunc('month', (now() at time zone 'America/Sao_Paulo')::date)::date then
    perform public._award_xp(new.user_id, 'budget_planned', 'M:' || to_char(new.month, 'YYYY-MM'), 20, null);
    perform public._mark_week_active(new.user_id);
  end if;
  return null;
end $$;
create trigger budget_assignments_award after insert or update of amount on public.budget_assignments
  for each row execute function public._budget_award();

-- ---------- Registrar investimento: XP uma vez por mês ----------
create or replace function public._trade_award()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._award_xp(new.user_id, 'investment_logged',
    'M:' || to_char((now() at time zone 'America/Sao_Paulo')::date, 'YYYY-MM'), 20, new.id);
  perform public._mark_week_active(new.user_id);
  return null;
end $$;
create trigger trades_award after insert on public.trades
  for each row execute function public._trade_award();

-- ---------- Metas de alocação: sem XP; a conquista sai no progresso ----------
-- Passa a devolver o progresso (antes, void): o tipo de retorno muda, então a função é recriada.
drop function public.set_allocation_targets(jsonb);
create function public.set_allocation_targets(p_targets jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_sum numeric;
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  select coalesce(sum((value)::numeric), 0) into v_sum from jsonb_each_text(p_targets) where (value)::numeric > 0;
  if v_sum <> 0 and abs(v_sum - 100) > 0.01 then raise exception 'as metas precisam somar 100'; end if;
  delete from public.allocation_targets where user_id = v_user;
  insert into public.allocation_targets (user_id, asset_class, percent)
    select v_user, key::public.asset_class, value::numeric from jsonb_each_text(p_targets) where value::numeric > 0;
  return public._refresh_progress(v_user) || jsonb_build_object('xp_awarded', 0);
end $$;

-- ---------- Permissões ----------
-- As escritas diretas (orçamento, operações) dão XP pelos gatilhos; as conquistas aparecem no próximo progresso.
revoke execute on function public._refresh_progress(uuid), public._refresh_progress_core(uuid) from public, anon, authenticated;
revoke execute on function public._budget_award(), public._trade_award() from public, anon, authenticated;
revoke execute on function public.import_transactions(uuid, jsonb, jsonb), public.set_allocation_targets(jsonb) from public, anon;
grant execute on function public.import_transactions(uuid, jsonb, jsonb), public.set_allocation_targets(jsonb) to authenticated;
