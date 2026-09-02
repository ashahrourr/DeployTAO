create table if not exists public.user_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_name text not null,
  coldkey_address text,
  wallet_volume text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table public.user_wallets enable row level security;

create policy "Users can view own wallet"
on public.user_wallets
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own wallet"
on public.user_wallets
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own wallet"
on public.user_wallets
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists user_wallets_user_id_idx
on public.user_wallets(user_id);
