create or replace function public.get_deployment_for_signal(
  p_deployment_id uuid,
  p_api_key text
)
returns table (
  id uuid,
  container_id text,
  asset_class text,
  metadata jsonb
)
language sql
security definer
set search_path = public
as $$
  select
    d.id,
    d.container_id,
    d.asset_class,
    d.metadata
  from public.deployments d
  where d.id = p_deployment_id
    and d.metadata #>> '{strategy,api_key}' = p_api_key
  limit 1;
$$;

create or replace function public.update_deployment_signal(
  p_deployment_id uuid,
  p_api_key text,
  p_trade_pair text,
  p_output text
)
returns table (
  id uuid,
  metadata jsonb,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  update public.deployments d
  set
    metadata = jsonb_set(
      jsonb_set(
        d.metadata,
        '{last_strategy_signal_output}',
        to_jsonb(right(p_output, 4000)),
        true
      ),
      '{last_strategy_signal_pair}',
      to_jsonb(p_trade_pair),
      true
    ),
    updated_at = now()
  where d.id = p_deployment_id
    and d.metadata #>> '{strategy,api_key}' = p_api_key
  returning d.id, d.metadata, d.updated_at;
$$;

grant execute on function public.get_deployment_for_signal(uuid, text) to anon, authenticated;
grant execute on function public.update_deployment_signal(uuid, text, text, text) to anon, authenticated;
