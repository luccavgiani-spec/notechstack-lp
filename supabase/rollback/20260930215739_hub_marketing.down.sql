-- Rollback de 20260930215739_hub_marketing.sql (movimento hub-marketing-agentes).
-- Antes de rodar: exportar marketing_actions (é o registro de auditoria).
-- Os grants revogados de anon/authenticated NÃO voltam: eram o risco E4.

select cron.unschedule('marketing-publish-due')
where exists (select 1 from cron.job where jobname = 'marketing-publish-due');

drop function if exists public.marketing_invoke_publish_due();
drop function if exists public.marketing_cron_secret_ok(text);
drop function if exists public.marketing_claim_due_posts(integer);

delete from vault.secrets where name in ('MARKETING_CRON_SECRET', 'marketing_hub_url');

drop table if exists public.marketing_cache;
drop table if exists public.marketing_actions;

-- O bucket `marketing-media` sai pela Storage API (o Supabase bloqueia DELETE direto
-- em storage.*): painel → Storage → esvaziar e apagar o bucket.

update public.scheduled_posts set status = 'failed' where status = 'cancelled';
alter table public.scheduled_posts drop constraint if exists scheduled_posts_status_check;
alter table public.scheduled_posts add constraint scheduled_posts_status_check
  check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed'));
alter table public.scheduled_posts
  drop column if exists meta_container_id,
  drop column if exists publish_attempts,
  drop column if exists created_by_role,
  drop column if exists created_by;

-- NOT NULL só volta se nenhuma linha estiver sem token.
do $$
begin
  if not exists (select 1 from public.ad_accounts where access_token is null) then
    alter table public.ad_accounts alter column access_token set not null;
  end if;
end;
$$;

-- A linha `no-tech-stack` em clients e as linhas de ad_accounts ficam: podem ter
-- posts e FKs ligados. Remover à mão, se for o caso.
