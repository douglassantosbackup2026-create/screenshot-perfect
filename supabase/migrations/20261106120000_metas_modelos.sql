-- Metas além da aposentadoria: modelo (reserva, viagem, imóvel, outro), o que está ligado à meta e o
-- ritmo mensal. Espelha os campos opcionais de Goal em src/lib/data/demo-store.ts; as telas ainda
-- gravam em user_state, então nada aqui muda o comportamento atual.

alter table public.goals
  add column template text not null default 'outro'
    check (template in ('reserva', 'viagem', 'imovel', 'outro')),
  add column asset_ids text[] not null default '{}',
  add column account_ids text[] not null default '{}',
  add column monthly_contribution numeric(14,2) check (monthly_contribution is null or monthly_contribution >= 0),
  add column expected_return numeric(6,4) check (expected_return is null or expected_return between -0.5 and 0.5);

-- Hábitos não têm valor, então também não têm ritmo nem vínculos.
alter table public.goals
  add constraint goals_habito_sem_ritmo
    check (kind = 'valor' or (monthly_contribution is null and asset_ids = '{}' and account_ids = '{}'));
