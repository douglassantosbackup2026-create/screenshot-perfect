-- Admin sem segundo fator obrigatório: o back-office abre só com o papel de admin.
-- Quem ativar o segundo fator por conta própria continua precisando dele (_mfa_ok não muda).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role()
$$;
