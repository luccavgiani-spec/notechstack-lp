-- Extend the existing authorized projection with agreed schedule and review label only.
create or replace function agency_private.overview(p_agency_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not agency_private.can_access(p_agency_id) then
    raise insufficient_privilege using message = 'AGENCY_ACCESS_DENIED';
  end if;
  select jsonb_build_object(
    'agency', jsonb_build_object('id', a.id, 'name', a.name, 'slug', a.slug, 'active', a.active),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'clientId', p.client_id, 'clientName', c.name,
        'status', coalesce(p.project_status::text, p.lead_status::text),
        'updatedAt', p.updated_at,
        'totalTasks', (select count(*) from public.kanban_items k where k.project_id = p.id),
        'doneTasks', (select count(*) from public.kanban_items k where k.project_id = p.id and k.status = 'concluido'),
        'overdueTasks', (select count(*) from public.kanban_items k where k.project_id = p.id and k.status <> 'concluido' and k.scheduled_date < current_date),
        'nextDate', coalesce((select min(k.scheduled_date)::text from public.kanban_items k where k.project_id = p.id and k.status <> 'concluido'), r.next_steps #>> '{presentation,delivery_to}'),
        'startedOn', r.next_steps #>> '{presentation,started_on}',
        'deliveryFrom', r.next_steps #>> '{presentation,delivery_from}',
        'deliveryTo', r.next_steps #>> '{presentation,delivery_to}',
        'deliveryNote', r.next_steps #>> '{presentation,delivery_note}',
        'reviewLabel', r.next_steps #>> '{presentation,review_label}'
      ) order by p.updated_at desc)
      from public.agency_projects ap
      join public.projects p on p.id = ap.project_id
      join public.clients c on c.id = p.client_id
      left join public.roadmaps r on r.project_id=p.id
      where ap.agency_id = a.id
    ), '[]'::jsonb)
  ) into result from public.agencies a where a.id = p_agency_id;
  return result;
end;
$$;
