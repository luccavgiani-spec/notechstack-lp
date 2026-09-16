-- F2-10 RFC: per-version allowlist, private immutable export metadata and ingest queue.
create table public.editor_version_configs (
  version_id uuid primary key references public.project_versions(id) on delete cascade,
  allowed_components jsonb not null default '[]'::jsonb check (jsonb_typeof(allowed_components) = 'array'),
  bridge_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.editor_exports (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id), base_version_id uuid not null references public.project_versions(id),
  changes jsonb not null check (jsonb_typeof(changes) = 'array'), manifest jsonb not null, request_id text not null unique, created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
create table public.editor_export_checklists (id uuid primary key default gen_random_uuid(), export_id uuid not null unique references public.editor_exports(id), status text not null default 'recebido', version_id uuid references public.project_versions(id), created_at timestamptz not null default now());
alter table public.editor_version_configs enable row level security; alter table public.editor_exports enable row level security; alter table public.editor_export_checklists enable row level security;
revoke all on public.editor_version_configs, public.editor_exports, public.editor_export_checklists from anon, authenticated;
grant all on public.editor_version_configs, public.editor_exports, public.editor_export_checklists to service_role;
create or replace function public.get_client_editor_config(p_project_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('versionId', v.id, 'label', v.label, 'buildReference', v.build_reference, 'allowedComponents', c.allowed_components, 'bridgeEnabled', c.bridge_enabled)
 from public.project_versions v join public.editor_version_configs c on c.version_id=v.id where v.project_id=p_project_id and v.is_current and public.can_read_project(p_project_id,'editor'); $$;
create or replace function public.submit_client_editor_export(p_project_id uuid,p_base_version_id uuid,p_changes jsonb,p_manifest jsonb,p_request_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.editor_exports%rowtype; v public.project_versions%rowtype; conflict boolean;
begin
 if not public.can_read_project(p_project_id,'editor') then raise exception using errcode='42501',message='EDITOR_ACCESS_DENIED'; end if;
 if jsonb_typeof(p_changes)<>'array' or nullif(trim(coalesce(p_request_id,'')),'') is null then raise exception using errcode='22023',message='EDITOR_EXPORT_INVALID'; end if;
 select * into e from public.editor_exports where request_id=p_request_id; if found then return jsonb_build_object('exportId',e.id,'replayed',true); end if;
 select * into v from public.project_versions where id=p_base_version_id and project_id=p_project_id; if not found then raise exception using errcode='P0002',message='EDITOR_VERSION_NOT_FOUND'; end if;
 select exists(select 1 from public.project_versions where project_id=p_project_id and is_current and id<>p_base_version_id) into conflict;
 insert into public.editor_exports(project_id,base_version_id,changes,manifest,request_id,created_by) values(p_project_id,p_base_version_id,p_changes,p_manifest||jsonb_build_object('baseVersionLabel',v.label,'conflict',conflict),p_request_id,auth.uid()) returning * into e;
 insert into public.editor_export_checklists(export_id) values(e.id);
 return jsonb_build_object('exportId',e.id,'replayed',false,'conflict',conflict); end; $$;
revoke all on function public.get_client_editor_config(uuid), public.submit_client_editor_export(uuid,uuid,jsonb,jsonb,text) from public,anon;
grant execute on function public.get_client_editor_config(uuid), public.submit_client_editor_export(uuid,uuid,jsonb,jsonb,text) to authenticated,service_role;
