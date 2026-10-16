-- Configuração do Editor da V2 · Espaço Saúde Mental (TASK-mvbfaammemy)
--
-- Passo 6 da ordem em .checks/espaco-saude-mental-editor.md: rodar no SQL Editor do
-- projeto "Nó Tech Stack" DEPOIS de publicar a V2 no admin (passo 3) e do merge/deploy
-- da cópia com o id da V2 (passo 5). Antes disso a V2 não existe.
--
-- Copia a allowlist da V1 como está (os 5 componentes nomeados e o modo automático
-- "*", ligado pela migration 20261002141941) e liga a ponte. allowed_components é um
-- array jsonb com {id, label, controls}; por isso é copiado da linha da V1, não
-- escrito à mão. get_client_editor_config só devolve a versão atual que tem linha
-- aqui: sem este passo o Editor da V2 abre vazio.

-- 0) Conferência antes (só leitura): versões do projeto e a config de cada uma.
select v.id, v.label, v.published_at, v.is_current, v.build_reference,
       c.bridge_enabled, jsonb_array_length(c.allowed_components) as itens
from public.project_versions v
left join public.editor_version_configs c on c.version_id = v.id
where v.project_id = '4fbc3859-a32f-4a71-b799-b005f32f65f8'
order by v.published_at;

-- 1) Gravação. Troque o id da V2 na linha marcada antes de rodar.
begin;

do $$
declare
  v_project constant uuid := '4fbc3859-a32f-4a71-b799-b005f32f65f8';
  v_v1 constant uuid := 'eb2ab04c-059e-4d70-8707-f9e7dc15384b';
  v_v2 constant uuid := '00000000-0000-0000-0000-000000000000'; -- TROQUE pelo id da V2
  v_allowed jsonb;
begin
  if v_v2 = '00000000-0000-0000-0000-000000000000' or v_v2 = v_v1 then
    raise exception 'Troque o id da V2 antes de rodar.';
  end if;

  if not exists (
    select 1 from public.project_versions
    where id = v_v2 and project_id = v_project and is_current
  ) then
    raise exception 'O id informado não é a versão atual deste projeto.';
  end if;

  -- O Editor monta o iframe a partir da referência do build; a V2 usa a mesma URL da V1.
  if not exists (
    select 1
    from public.project_versions v2
    join public.project_versions v1 on v1.id = v_v1
    where v2.id = v_v2 and v2.build_reference = v1.build_reference
  ) then
    raise exception 'A referência do build da V2 difere da V1; o Editor abriria outra página.';
  end if;

  select allowed_components into v_allowed
  from public.editor_version_configs
  where version_id = v_v1;

  if v_allowed is null then
    raise exception 'A V1 não tem configuração do Editor para copiar.';
  end if;

  if (
    select count(distinct item ->> 'id')
    from jsonb_array_elements(v_allowed) item
    where item ->> 'id' in ('marca_topo', 'hero_titulo', 'hero_texto', 'hero_cta', 'valores_titulo', '*')
  ) <> 6 then
    raise exception 'A allowlist da V1 não tem os 5 componentes e o modo automático.';
  end if;

  insert into public.editor_version_configs (version_id, allowed_components, bridge_enabled)
  values (v_v2, v_allowed, true)
  on conflict (version_id) do update
    set allowed_components = excluded.allowed_components,
        bridge_enabled = true;
end $$;

commit;

-- 2) Conferência depois: a V2 aparece atual, com a ponte ligada e os mesmos itens da V1.
select v.label, v.is_current, c.bridge_enabled,
       (select jsonb_agg(item ->> 'id') from jsonb_array_elements(c.allowed_components) item) as componentes
from public.editor_version_configs c
join public.project_versions v on v.id = c.version_id
where v.project_id = '4fbc3859-a32f-4a71-b799-b005f32f65f8'
order by v.published_at;
