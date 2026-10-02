-- OAuth do planner: state de uso único, Vault e trilha na mesma transação.
-- RPCs expostas somente à service role da Edge Function; nunca ao navegador.
create or replace function public.marketing_google_state_consume(p_state text)
returns uuid language sql security invoker set search_path = ''
as $$
  with consumed as (
    delete from public.marketing_cache
    where key = 'google_oauth_state:' || p_state
      and p_state ~ '^[a-f0-9]{64}$'
    returning payload, expires_at
  )
  select (payload->>'user_id')::uuid from consumed
  where expires_at > now();
$$;

create or replace function public.marketing_google_refresh_read()
returns text language sql security definer set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets
  where name = 'marketing_google_refresh_token';
$$;

create or replace function public.marketing_google_connection_save(
  p_user_id uuid, p_refresh_token text, p_request_id text
)
returns void language plpgsql security definer set search_path = ''
as $$
declare secret_id uuid;
begin
  if p_refresh_token is null or length(p_refresh_token) = 0 then
    raise exception 'Google OAuth token ausente';
  end if;
  -- O admin pode ter sido desligado enquanto estava na tela de consentimento.
  if not exists (select 1 from auth.users where id = p_user_id
    and raw_app_meta_data->>'role' = 'NO_ADMIN'
    and (banned_until is null or banned_until <= now())) then
    raise exception 'Google OAuth autor não autorizado';
  end if;
  -- Serializa a primeira criação e reconexões concorrentes.
  perform pg_catalog.pg_advisory_xact_lock(726431098);
  select id into secret_id from vault.secrets where name = 'marketing_google_refresh_token';
  if secret_id is null then
    perform vault.create_secret(p_refresh_token, 'marketing_google_refresh_token');
  else
    perform vault.update_secret(secret_id, p_refresh_token);
  end if;
  insert into public.marketing_actions(request_id, actor_user_id, actor_role, kind, payload, status, result, finished_at)
  values (p_request_id, p_user_id, 'NO_ADMIN', 'google.conectar', '{}'::jsonb, 'ok', '{"conectado":true}'::jsonb, now());
end;
$$;

revoke all on function public.marketing_google_state_consume(text) from public, anon, authenticated;
revoke all on function public.marketing_google_refresh_read() from public, anon, authenticated;
revoke all on function public.marketing_google_connection_save(uuid, text, text) from public, anon, authenticated;
grant execute on function public.marketing_google_state_consume(text) to service_role;
grant execute on function public.marketing_google_refresh_read() to service_role;
grant execute on function public.marketing_google_connection_save(uuid, text, text) to service_role;
