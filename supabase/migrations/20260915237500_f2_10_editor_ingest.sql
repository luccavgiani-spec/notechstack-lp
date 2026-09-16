create or replace function public.ingest_editor_export(p_export_id uuid,p_request_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.editor_exports%rowtype; c public.editor_export_checklists%rowtype; x jsonb; n integer:=0;
begin
 perform public.r1_06_require_admin(); if public.r1_06_is_replay(p_request_id,null,'editor.export_ingested') then return jsonb_build_object('replayed',true); end if;
 select * into e from public.editor_exports where id=p_export_id for update; if not found then raise exception using errcode='P0002',message='EDITOR_EXPORT_NOT_FOUND'; end if;
 select * into c from public.editor_export_checklists where export_id=e.id for update; if c.status='ingerido' then return jsonb_build_object('replayed',true); end if;
 if (select project_status from public.projects where id=e.project_id)<>'EM_REVISAO_CLIENTE'::public.project_status then raise exception using errcode='P0001',message='EDITOR_INGEST_NOT_ALLOWED'; end if;
 perform set_config('app.skip_activity','on',true);
 for x in select value from jsonb_array_elements(e.changes) loop n:=n+1; insert into public.kanban_items(project_id,title,phase,macro_version,status,position) values(e.project_id,'Editor — '||coalesce(x->>'component','ajuste'),'Editor','V2','a_fazer',n); end loop;
 update public.editor_export_checklists set status='ingerido' where id=c.id; update public.projects set project_status='ALTERACOES_RECEBIDAS'::public.project_status where id=e.project_id;
 perform set_config('app.skip_activity','off',true); perform public.r1_06_event(e.project_id,'editor.export_ingested',jsonb_build_object('export_id',e.id,'items',n),p_request_id); return jsonb_build_object('replayed',false,'items',n); end; $$;
revoke all on function public.ingest_editor_export(uuid,text) from public,anon; grant execute on function public.ingest_editor_export(uuid,text) to authenticated,service_role;
