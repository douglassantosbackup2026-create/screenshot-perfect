create table public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.user_state to authenticated;
grant all on public.user_state to service_role;
alter table public.user_state enable row level security;
create policy "own state read" on public.user_state for select to authenticated using (auth.uid() = user_id);
create policy "own state insert" on public.user_state for insert to authenticated with check (auth.uid() = user_id);
create policy "own state update" on public.user_state for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);