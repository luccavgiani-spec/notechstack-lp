-- Project branding is resolved on the server. Client table access is unchanged.
alter table public.agencies add column logo_url text
  check (logo_url is null or logo_url ~ '^/[^/]' or logo_url ~ '^https://');

create function agency_private.client_branding(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.can_read_project(p_project_id) then
    return null;
  end if;
  return (
    select jsonb_build_object('name', a.name, 'logoUrl', a.logo_url)
    from public.agency_projects ap join public.agencies a on a.id = ap.agency_id
    where ap.project_id = p_project_id
  );
end;
$$;
revoke all on function agency_private.client_branding(uuid) from public, anon;
grant execute on function agency_private.client_branding(uuid) to authenticated;

create function public.get_client_project_branding(p_project_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select agency_private.client_branding(p_project_id);
$$;
revoke all on function public.get_client_project_branding(uuid) from public, anon;
grant execute on function public.get_client_project_branding(uuid) to authenticated;
