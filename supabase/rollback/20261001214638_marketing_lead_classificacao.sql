-- Rollback manual: preserva o funil; apaga somente a trilha introduzida nesta entrega.
begin;
drop table public.lead_classificacao;
commit;
