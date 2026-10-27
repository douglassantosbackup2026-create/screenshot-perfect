-- Endurecimento: fecha EXECUTE público de utilitário interno e fixa search_path.
-- Policies do reminder_log ficam em 20261031120000_lembretes (tabela criada lá).

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

alter function public._nominal_date(public.recurring_rules, integer) set search_path = public;
alter function public._adjust_weekend(date, public.weekend_rule) set search_path = public;
