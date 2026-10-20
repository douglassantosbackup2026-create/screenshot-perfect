-- Conta do livro-caixa ligada a um item do Patrimônio: o valor do item passa a ser o saldo da conta.
-- Espelha Account.assetId, saveAccount e withLinkedAssets (src/lib/data/demo-store.ts).
-- O app grava o novo valor com upsert_asset (que guarda o histórico) sempre que o saldo muda.

alter table public.accounts
  add column if not exists asset_id uuid references public.assets(id) on delete set null;
create unique index if not exists accounts_asset_unique on public.accounts(asset_id) where asset_id is not null;

-- Só contas de previdência ou investimentos, e só itens da própria pessoa.
create or replace function public._accounts_check_asset()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.asset_id is null then return new; end if;
  if new.kind not in ('investimento', 'previdencia') then
    raise exception 'so contas de previdencia ou investimentos podem ser ligadas a um item do patrimonio';
  end if;
  if not exists (select 1 from public.assets where id = new.asset_id and user_id = new.user_id) then
    raise exception 'item do patrimonio nao encontrado';
  end if;
  return new;
end $$;
create trigger accounts_check_asset before insert or update of asset_id, kind on public.accounts
  for each row execute function public._accounts_check_asset();

revoke execute on function public._accounts_check_asset() from public, anon, authenticated;
