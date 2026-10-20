-- Leads com a simulação e a origem da visita, um por e-mail.
-- Espelha submitLead (src/server/leads.ts). A tabela continua só de inserção para o público.

alter table public.leads
  add column if not exists simulation jsonb check (simulation is null or jsonb_typeof(simulation) = 'object'),
  add column if not exists utm_source text check (utm_source is null or char_length(utm_source) <= 80),
  add column if not exists utm_medium text check (utm_medium is null or char_length(utm_medium) <= 80),
  add column if not exists utm_campaign text check (utm_campaign is null or char_length(utm_campaign) <= 80);

-- Um lead por e-mail (o mais antigo fica).
delete from public.leads l
  using public.leads older
  where lower(btrim(l.email)) = lower(btrim(older.email)) and older.created_at < l.created_at;
create unique index if not exists leads_email_unique on public.leads (lower(btrim(email)));
