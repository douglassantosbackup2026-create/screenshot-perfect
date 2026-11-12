revoke select on public.plan_prices from anon, authenticated;
grant select (plan, period, cents, updated_at) on public.plan_prices to anon, authenticated;
revoke select on public.calc_settings from anon, authenticated;
grant select (id, return_conservador, return_central, return_otimista, inflation, horizon, costs, updated_at) on public.calc_settings to anon, authenticated;

drop policy if exists "precos: todos leem" on public.plan_prices;
create policy "precos: todos leem" on public.plan_prices for select to anon, authenticated
  using (cents > 0);
drop policy if exists "calculadora: todos leem" on public.calc_settings;
create policy "calculadora: todos leem" on public.calc_settings for select to anon, authenticated
  using (id = true);