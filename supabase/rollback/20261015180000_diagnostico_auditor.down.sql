-- Reverte supabase/migrations/20261015180000_diagnostico_auditor.sql (TASK-mv9tw7q71do).
-- Fica fora de migrations de proposito: o db push nao aplica. Apaga os dados do diagnostico.
-- Roda numa transacao so: se qualquer drop falhar, nada e desfeito pela metade.
begin;
drop function if exists public.diag_registrar_alerta(date, text, text);
drop function if exists public.diag_registrar_envio(text, text, text);
drop function if exists public.diag_concluir(text, boolean, jsonb);
drop function if exists public.diag_reservar(text, text, text, text, boolean, jsonb, text);
drop view if exists public.diag_contagem_diaria;
drop table if exists public.diag_alertas;
drop table if exists public.diag_eventos;
drop table if exists public.diag_cache;
drop table if exists public.diag_config;
commit;
