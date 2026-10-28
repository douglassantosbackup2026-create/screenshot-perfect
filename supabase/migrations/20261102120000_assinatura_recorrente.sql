-- Assinatura recorrente (Mercado Pago preapproval). Não existe mais plano grátis: o acesso vem de
-- `entitlements`, estendido a cada cobrança aprovada por credit_payment. Esta tabela guarda a assinatura
-- em si (id no Mercado Pago e status) para mostrar na tela de Assinatura e para cancelar.
-- Só o servidor (service_role) grava; a pessoa só lê a própria.

create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preapproval_id text not null unique check (length(preapproval_id) <= 64),
  plan text not null check (plan in ('inteligencia', 'pro')),
  period text not null check (period in ('mensal', 'anual')),
  -- pending, authorized, paused ou cancelled, como o Mercado Pago informa.
  status text not null check (length(status) <= 32),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "assinatura: ler a propria" on public.subscriptions for select to authenticated using (user_id = auth.uid());

grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
