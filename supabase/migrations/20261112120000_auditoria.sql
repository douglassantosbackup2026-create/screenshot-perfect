-- Correções da auditoria de produção (docs/AUDITORIA-PRODUCAO.md). Nada aqui apaga dados.

-- 1. Admin que ativou o segundo fator precisa dele também no back-office. 20261108120000 tirou a exigência
--    de todo admin, mas as funções de admin passam por cima do RLS (_mfa_ok) e abriam só com a senha.
--    Admin sem segundo fator continua entrando como antes.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role() and public._mfa_ok()
$$;

-- 2. whatsapp_links: a pessoa só muda as preferências. Se o projeto deu UPDATE na tabela inteira por padrão,
--    a policy de update deixaria trocar telefone e data de verificação.
revoke update on public.whatsapp_links from anon, authenticated;
grant update (proactive_opt_in, discreet) on public.whatsapp_links to authenticated;

-- 3. Tabelas usadas só pelo servidor e pelas funções: sem nenhum privilégio para anon/authenticated
--    (o RLS já bloqueia; isto fecha também os privilégios padrão do Supabase).
revoke all on public.app_settings, public.whatsapp_link_codes, public.whatsapp_messages, public.analytics_events,
  public.consent_log, public.affiliates, public.referrals, public.affiliate_commissions, public.coupons,
  public.coupon_redemptions
  from anon, authenticated;

-- 3b. Preços: leitura pública, escrita só por admin_set_plan_price. O RLS já não deixava gravar (0 linhas),
--     mas o privilégio padrão de insert/update/delete continuava lá.
revoke insert, update, delete, truncate on public.plan_prices from anon, authenticated;

-- 4. Retratos do plano: entradas e resultados do motor têm poucos KB; 64 KB é folga, não limite de uso.
--    NOT VALID: vale para o que for gravado daqui em diante, sem reler o que já existe.
alter table public.plan_snapshots
  add constraint plan_snapshots_inputs_size check (pg_column_size(inputs) < 65536) not valid,
  add constraint plan_snapshots_outputs_size check (pg_column_size(outputs) < 65536) not valid;
