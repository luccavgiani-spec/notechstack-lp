insert into storage.buckets(id,name,public) values ('editor-exports','editor-exports',false) on conflict (id) do nothing;
create policy editor_exports_client_upload on storage.objects for insert to authenticated with check (bucket_id='editor-exports' and public.can_read_project(split_part(name,'/',1)::uuid,'editor'));
create policy editor_exports_client_read on storage.objects for select to authenticated using (bucket_id='editor-exports' and public.can_read_project(split_part(name,'/',1)::uuid,'editor'));
create or replace function public.editor_export_validate() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from jsonb_array_elements(new.changes) x where not exists(select 1 from public.editor_version_configs c,jsonb_array_elements(c.allowed_components) a where c.version_id=new.base_version_id and a->>'id'=x->>'component')) then raise exception using errcode='22023',message='EDITOR_COMPONENT_NOT_ALLOWED'; end if;
 new.manifest:=new.manifest||jsonb_build_object('sha256',encode(extensions.digest(new.changes::text||new.base_version_id::text,'sha256'),'hex'));
 return new; end; $$;
create trigger editor_export_validate before insert on public.editor_exports for each row execute function public.editor_export_validate();
