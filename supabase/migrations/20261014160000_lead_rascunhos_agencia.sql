-- /agencia também grava rascunho privado (mesma tabela, outro modo).
alter table public.lead_rascunhos drop constraint lead_rascunhos_modo_check;
alter table public.lead_rascunhos add constraint lead_rascunhos_modo_check check (modo in ('contato','contato_home','agencia'));
