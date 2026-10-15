-- TASK-mv9tw7qa86v: retencao do auditor (aprovada por Lucca em docs/proposta-privacidade-retencao-auditor.md).
-- diag_cache 7 dias (gerado_em), diag_eventos 90 dias (criado_em), diag_alertas 90 dias (criado_em).
-- Limpeza diaria as 06:00 UTC = 03:00 America/Sao_Paulo, pelo pg_cron
-- (extensao criada em 20260930215739_hub_marketing.sql; no projeto: pg_cron 1.6.4).
-- Efeito aceito: sem janela_usuario_horas, o "3 por IP" de diag_reservar passa a valer por 90 dias.
-- Idempotente: create or replace + desagenda o job antes de agendar de novo.
-- Reversao: supabase/rollback/20261015230000_auditor_retencao.down.sql

create or replace function public.diag_limpar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cache int;
  v_eventos int;
  v_alertas int;
begin
  delete from public.diag_cache where gerado_em < now() - interval '7 days';
  get diagnostics v_cache = row_count;

  delete from public.diag_eventos where criado_em < now() - interval '90 days';
  get diagnostics v_eventos = row_count;

  delete from public.diag_alertas where criado_em < now() - interval '90 days';
  get diagnostics v_alertas = row_count;

  return jsonb_build_object(
    'diag_cache', v_cache,
    'diag_eventos', v_eventos,
    'diag_alertas', v_alertas);
end;
$$;

revoke all on function public.diag_limpar() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job
              where jobname = 'diag_limpar_diario' and username = current_user) then
    perform cron.unschedule('diag_limpar_diario');
  end if;
  perform cron.schedule('diag_limpar_diario', '0 6 * * *', 'select public.diag_limpar()');
end
$$;
