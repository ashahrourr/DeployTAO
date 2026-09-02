create table if not exists public.user_integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  access_token text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

alter table public.user_integrations enable row level security;

create policy "Users can view own integrations"
on public.user_integrations
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can create own integrations"
on public.user_integrations
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own integrations"
on public.user_integrations
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists user_integrations_user_id_provider_idx
on public.user_integrations(user_id, provider);
