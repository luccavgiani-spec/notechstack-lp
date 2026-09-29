# Salvamento parcial e retirada da v7 — 29/09/2026

Estado em 29/09: publicação autorizada. Migração 20260929173008 aplicada e save-lead-progress v1 ACTIVE. Teste sintético confirmou nome + WhatsApp na etapa 2; leitura por anon/authenticated e execução pública da RPC negadas. Frontend/redirecionamento publicados pelo PR #46, commit 849263c8, deployment dpl_2SyYhxKp7p9dYicJnEKrLkoKZ2Qk READY. Rascunhos Home/Contato confirmados por teste de navegador. Ajuste de checkbox final em publicação.

## Comportamento

- Home e Contato salvam nome, WhatsApp, negócio, objetivo, descrição e links durante o preenchimento (pausa de 1 segundo, saída do campo e avanço). Arquivos só seguem no envio final.
- `form_etapa` registra as etapas validadas 1–5, sem dados pessoais no dataLayer; mantém `form_pergunta_concluida` por compatibilidade.
- As respostas seguem exclusivamente para `save-lead-progress` → `salvar_lead_rascunho` → `lead_rascunhos`. Não geram e-mail, conversão, CAPI ou linha em `leads` antes do envio final.
- Uma linha por sessão/modo. Versão monotônica evita que requisições atrasadas sobrescrevam respostas novas. O rascunho é a versão mais recente, não um histórico de edições.
- `leads_para_retomar` mostra rascunhos sem envio concluído, sem lead correspondente e sem atualização há 30 minutos. Nome sem telefone permite identificar o rascunho, mas não permite entrar em contato.
- RLS e permissões impedem leitura/escrita por `anon` e `authenticated`; a função pública permite apenas gravação e retorna somente confirmação. Não existe endpoint público de consulta.
- Por solicitação do usuário, não há aviso no início do formulário. A última etapa exige checkbox desmarcado por padrão com links para Termos de Uso e Política de Privacidade; a política explica o salvamento parcial. O checkbox valida somente o envio final, sem impedir a recuperação de rascunhos.
- Encerramento abrupto/offline pode impedir o último salvamento; há tentativas limitadas e beacon ao sair, sem promessa de entrega garantida. Não há armazenamento local de respostas nem retomada automática no navegador.
- v7 e variante com barra final redirecionam permanentemente à home (308 na Vercel), preservando o destino de links antigos. Não apagar o HTML de referência nesta etapa.

## Consultar após publicar

No Supabase do projeto `sdeowbqmwkwseyktyemn`, Table Editor → `lead_rascunhos` para todos os rascunhos; SQL Editor:

```sql
select nome, whatsapp, etapa, respostas, origem, atualizado_em
from public.leads_para_retomar
order by atualizado_em desc;
```

## Ordem de publicação (exige autorização de produção do Núcleo)

1. Aplicar somente `20260929173008_lead_rascunhos.sql` no banco correto; verificar permissões e advisors.
2. Publicar somente `save-lead-progress`, com `verify_jwt=false` conforme config. Não alterar `send-lead-email`.
3. Publicar arquivos deste ajuste: `shared/lead-progress.js`, `historia/home-contato.js`, inclusão do script na home/contato, parágrafo da privacidade e redirects de `vercel.json`. Há alterações anteriores do usuário nesses HTMLs: preservar e não incluir outras mudanças indiscriminadamente.
4. Conferir URL antiga → 308 → home e parâmetros de campanha; executar teste sintético identificado de salvamento com autorização, sem enviar lead/e-mail real. Checar rascunho e ausência de PII nos eventos GA4.
5. Conferir no GTM que `form_etapa` envia `etapa`/`passo`, e `capitulo_visto` envia `capitulo`/`ordem`; as configurações remotas do GTM/GA4 não foram alteradas.

## Verificação executada

`node .checks/seo/test-lead-progress.mjs`: PostgreSQL isolado com PGlite, migração real, endpoint com acesso ao banco isolado, permissões, idempotência/ordenação, abandono/conclusão e scripts reais dos dois formulários em DOM simulado. Teste de redirects estático, ainda sem deployment para verificar resposta 308.

`node .checks/home-assets/test-lead-attachments.mjs`: regressão de anexos e compatibilidade do envio final.

Dependências de teste fora do projeto: `npm install --prefix "$env:TEMP/no-lead-progress-tests" --no-save --package-lock=false @electric-sql/pglite@0.3.14 linkedom@0.18.12`.

## Evidência da página antiga

GET público em 29/09: v7 respondeu 200, cabeçalho `X-Robots-Tag: noindex, nofollow`, fora do sitemap atual, carregando `historia/diagnostico.js`. Não foi consultada a conta GA4 para quantificar visitas; a consulta a `lead_eventos` não encontrou registros com indicação da v7, o que NÃO comprova ausência de tráfego.
