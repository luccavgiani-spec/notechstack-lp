-- Reverte supabase/migrations/20261015230000_auditor_retencao.sql (TASK-mv9tw7qa86v).
-- Fica fora de migrations de proposito: o db push nao aplica. Nao apaga dado nenhum:
-- so para a limpeza diaria; o que ja foi apagado nao volta.
-- Ordem: rodar este antes do 20261015180000_diagnostico_auditor.down.sql.
-- Roda numa transacao so e pode rodar duas vezes (sem job ou sem pg_cron, so segue).
begin;
do $$
begin
  if to_regclass('cron.job') is not null then
    if exists (select 1 from cron.job
                where jobname = 'diag_limpar_diario' and username = current_user) then
      perform cron.unschedule('diag_limpar_diario');
    end if;
  end if;
end
$$;
drop function if exists public.diag_limpar();
commit;
