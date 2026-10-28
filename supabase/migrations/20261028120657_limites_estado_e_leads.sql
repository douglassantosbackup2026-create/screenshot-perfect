-- Limites de entrada que faltavam no banco (a validação do app sozinha não basta).
-- NOT VALID: vale para toda gravação nova sem travar a migration por causa de linhas antigas.

-- user_state: o estado de cada pessoa precisa ser um objeto JSON e ter tamanho razoável.
-- O app conserta o conteúdo ao ler (src/lib/data/state-schema.ts); aqui só barra lixo e abuso de espaço.
alter table public.user_state
  add constraint user_state_data_objeto check (jsonb_typeof(data) = 'object') not valid,
  add constraint user_state_data_tamanho check (pg_column_size(data) < 2000000) not valid;

-- leads: o público só insere; limita o tamanho do que chega.
alter table public.leads
  add constraint leads_email_tamanho check (char_length(email) <= 254) not valid,
  add constraint leads_source_tamanho check (char_length(source) <= 40) not valid;

-- is_admin(): "a pessoa conectada é admin?", sem receber um id.
-- has_role(uuid, papel) continua liberada para authenticated porque as policies de RLS a usam,
-- mas deixa qualquer conta perguntar sobre qualquer id; o app passa a usar is_admin().
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin')
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
