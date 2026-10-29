-- O registro de lembretes enviados é do servidor (service_role, que ignora RLS): a pessoa só lê o próprio.
-- Antes ela também podia inserir, alterar e apagar, e com isso suprimir ou repetir os próprios lembretes.
drop policy if exists "reminder_log: inserir o proprio" on public.reminder_log;
drop policy if exists "reminder_log: atualizar o proprio" on public.reminder_log;
drop policy if exists "reminder_log: apagar o proprio" on public.reminder_log;
revoke insert, update, delete on public.reminder_log from authenticated;
