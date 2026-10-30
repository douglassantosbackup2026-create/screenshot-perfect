-- Open Finance (estrutura): conexões com bancos por um agregador. Por enquanto só o provedor de teste
-- ('mock'); um agregador real (Pluggy, Belvo) entra como mais um valor de provider.
-- As contas e os lançamentos continuam em user_state (as contas guardam connectionId e externalId).

create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('mock')),
  -- Id da conexão no agregador ("item").
  item_id text not null check (char_length(item_id) <= 128),
  institution text check (char_length(institution) <= 120),
  status text not null default 'ativa' check (status in ('ativa', 'erro', 'revogada')),
  last_synced_at timestamptz,
  consent_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, item_id)
);
create index on public.bank_connections (user_id);
alter table public.bank_connections enable row level security;

-- A pessoa vê e desconecta as próprias; criar e atualizar é só do servidor (depois de falar com o agregador).
create policy "bancos: ler os proprios" on public.bank_connections
  for select to authenticated using (user_id = auth.uid());
create policy "bancos: apagar os proprios" on public.bank_connections
  for delete to authenticated using (user_id = auth.uid());

grant select, delete on public.bank_connections to authenticated;
grant all on public.bank_connections to service_role;
