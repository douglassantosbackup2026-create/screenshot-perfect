-- Conta com e-mail e senha: metas do perfil que o app já guarda e exclusão da própria conta.
-- Espelha Profile.goalRetirementAge / goalIncome (src/lib/data/demo-store.ts) e account.deleteAccount (src/lib/data/session.ts).

alter table public.profiles
  add column if not exists goal_retirement_age int check (goal_retirement_age is null or goal_retirement_age between 30 and 90),
  add column if not exists goal_income numeric(12,2) check (goal_income is null or goal_income > 0);

-- Exclui o usuário logado. As tabelas com user_id → auth.users on delete cascade levam todos os dados junto.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'nao autenticado'; end if;
  delete from auth.users where id = v_user;
end $$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
