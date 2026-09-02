create table if not exists public.deployments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subnet text not null,
  mode text not null default 'managed',
  network text not null,
  status text not null default 'draft',
  asset_class text,
  wallet_mode text,
  container_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.deployments enable row level security;

create policy "Users can view own deployments"
on public.deployments
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own deployments"
on public.deployments
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own deployments"
on public.deployments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists deployments_user_id_idx
on public.deployments(user_id);

create index if not exists deployments_status_idx
on public.deployments(status);
