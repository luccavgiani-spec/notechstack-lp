create or replace function public.confirm_admin_schedule_proposal(p_project_id uuid, p_items jsonb, p_request_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_project public.projects%rowtype; v_item jsonb; v_index integer := 0; v_saved public.kanban_items%rowtype;
begin
  perform public.r1_06_require_admin();
  if nullif(trim(coalesce(p_request_id, '')), '') is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception using errcode = '22023', message = 'SCHEDULE_PROPOSAL_INVALID'; end if;
  if public.r1_06_is_replay(p_request_id, p_project_id, 'schedule.proposal_confirmed') then return jsonb_build_object('replayed', true); end if;
  select * into v_project from public.projects where id = p_project_id for update;
  if not found or v_project.project_status <> 'CONVERTIDO'::public.project_status then raise exception using errcode = 'P0001', message = 'SCHEDULE_PROPOSAL_NOT_ALLOWED'; end if;
  perform set_config('app.skip_activity', 'on', true);
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_index := v_index + 1;
    insert into public.kanban_items(project_id, title, macro_version, status, scheduled_date, position)
    values (p_project_id, nullif(trim(v_item ->> 'title'), ''), v_item ->> 'macro_version', 'a_fazer', (v_item ->> 'scheduled_date')::date, coalesce((v_item ->> 'position')::integer, v_index)) returning * into v_saved;
    perform public.r1_06_event(p_project_id, 'kanban_item.created', jsonb_build_object('item_id', v_saved.id, 'depois', to_jsonb(v_saved)), p_request_id || ':' || v_index);
  end loop;
  perform set_config('app.skip_activity', 'off', true);
  perform public.r1_06_event(p_project_id, 'schedule.proposal_confirmed', jsonb_build_object('count', v_index), p_request_id);
  return jsonb_build_object('replayed', false, 'count', v_index);
exception when others then perform set_config('app.skip_activity', 'off', true); raise;
end; $$;
revoke all on function public.confirm_admin_schedule_proposal(uuid, jsonb, text) from public, anon;
grant execute on function public.confirm_admin_schedule_proposal(uuid, jsonb, text) to authenticated, service_role;
