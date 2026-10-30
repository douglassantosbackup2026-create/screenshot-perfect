-- Mitikos no WhatsApp (Cloud API da Meta). O webhook (service_role) lê e grava; a pessoa vê e controla
-- o próprio vínculo no Perfil. Mensagens não são guardadas: só o id, para nunca processar a mesma duas vezes.

-- Número conectado a uma conta. Um número por conta, e cada número em uma conta só.
create table public.whatsapp_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone text not null unique check (phone ~ '^[0-9]{8,15}$'),
  verified_at timestamptz not null default now(),
  -- Avisos proativos (limite, conta a vencer, resumos): só com aceite.
  proactive_opt_in boolean not null default false,
  -- Modo discreto: respostas sem valores.
  discreet boolean not null default false,
  -- Último lançamento feito pelo WhatsApp, para "desfazer" por texto.
  last_tx_id text check (length(last_tx_id) <= 64),
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_links enable row level security;
create policy "whatsapp: ler o proprio" on public.whatsapp_links for select to authenticated using (user_id = auth.uid());
create policy "whatsapp: ajustar o proprio" on public.whatsapp_links for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "whatsapp: desconectar" on public.whatsapp_links for delete to authenticated using (user_id = auth.uid());
grant select, delete on public.whatsapp_links to authenticated;
-- A pessoa só muda as preferências; telefone e vínculo são do servidor.
grant update (proactive_opt_in, discreet) on public.whatsapp_links to authenticated;
grant all on public.whatsapp_links to service_role;

-- Código de conexão: o app gera, a pessoa manda pelo WhatsApp, o webhook vincula o número. Vale 10 minutos.
create table public.whatsapp_link_codes (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
create index on public.whatsapp_link_codes(user_id);
alter table public.whatsapp_link_codes enable row level security;
grant all on public.whatsapp_link_codes to service_role;

-- Mensagens já processadas (só o id da Meta), para a mesma notificação reenviada não lançar duas vezes.
create table public.whatsapp_messages (
  id text primary key check (length(id) <= 200),
  received_at timestamptz not null default now()
);
create index on public.whatsapp_messages(received_at);
alter table public.whatsapp_messages enable row level security;
grant all on public.whatsapp_messages to service_role;
