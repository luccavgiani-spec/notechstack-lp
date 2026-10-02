-- Editor: images the client picks from their computer to replace a photo.
--
-- Public read, because the preview iframe and later the live site show the
-- file by URL. Writes are limited to clients with the Editor module on that
-- project, inside the project's own folder, with a random file name.
-- SVG is left out on purpose: it can carry script.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'editor-assets',
  'editor-assets',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- "<project uuid>/<random uuid>.<png|jpg|webp|gif>" and Editor access to that project.
create or replace function public.can_write_editor_asset(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_project uuid;
begin
  if array_length(string_to_array(p_name, '/'), 1) <> 2
    or split_part(p_name, '/', 2) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|gif)$' then
    return false;
  end if;
  begin
    v_project := split_part(p_name, '/', 1)::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return public.can_read_project(v_project, 'editor');
end;
$$;
revoke all on function public.can_write_editor_asset(text) from public, anon, authenticated;
grant execute on function public.can_write_editor_asset(text) to authenticated, service_role;

drop policy if exists editor_assets_client_upload on storage.objects;
create policy editor_assets_client_upload on storage.objects for insert to authenticated
with check (bucket_id = 'editor-assets' and public.can_write_editor_asset(name));

-- The upload API reads the inserted row back, which RLS treats as a select.
drop policy if exists editor_assets_client_read on storage.objects;
create policy editor_assets_client_read on storage.objects for select to authenticated
using (bucket_id = 'editor-assets' and public.can_write_editor_asset(name));
