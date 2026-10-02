# Apêndice auditável — país e promessa conjunta

Coleta complementar: 2026-10-01. [Registro individual das 50 marcas](auditoria-por-marca.csv), ligado pelo nome exato a [marcas.csv](marcas.csv). As 17 colunas da base original foram preservadas.

## País

40/50 têm evidência pública de vínculo empresarial brasileiro; 2/50 têm sede/origem internacional declarada (Bioma: Uruguai; ReplyAgent: Estados Unidos); 8/50 permanecem desconhecidas. Mesmo se as 8 desconhecidas fossem internacionais, seriam no máximo 10/50: **2 + 8 = 10**. Isso demonstra o teto numérico, sem atribuir país às desconhecidas. Não comprova que todas as desconhecidas, caso internacionais, cumpram a condição adicional de white-label para agências: esse recorte continua parcialmente pendente.

Bioma declara estúdio uruguaio e parceria técnica white-label para agências na própria página [Partners](https://www.biomadigital.com/partners.html). ReplyAgent declara sede nos Estados Unidos em [Contato](https://www.replyagent.com/pt-br/contact-us/) e oferta para agências na página [White-label](https://www.replyagent.com/pt-br/white-label/). Assim, as 2 internacionais identificadas cumprem a condição adicional.

Desconhecidas: Web4Business, AutoAgencia, Datalitics, Nexio System, Aurabit, Galáxia Digital, GVD Soluções e Vision Developer. Cidade herdada no CSV não foi tratada como prova autossuficiente. Datalitics cita foro brasileiro, o que não basta para concluir sede. Não inferimos país de domínio, português, moeda, telefone ou mercado atendido. Registro empresarial brasileiro/CNPJ na página oficial é evidência de vínculo jurídico no Brasil, sem implicar operação exclusivamente nacional. Não copiamos números de cadastro, contatos ou nomes pessoais.

Cada linha informa a evidência resumida e URL oficial. `busca_publica_pagina_oficial` distingue fontes recuperadas pela busca de páginas diretamente abertas; não significa visita autenticada nem captura integral. Declarações são das próprias marcas, não auditoria registral independente. Cappei teve leitura direta indisponível e resultado oficial parcial; localização foi explícita no texto recuperado.

## Roadmap + protótipo em 3 dias

Definição: a mesma oferta deve reunir roadmap, protótipo e prazo de 3 dias para essa entrega. Trial, onboarding, prazo de orçamento e prazo de landing page não contam. Revisão do texto recuperado da página principal de oferta por marca e busca textual por `3 dias`; a cobertura não inclui todas as páginas do domínio, imagens, vídeos ou conteúdos não recuperados. Formulações não textuais ou sinônimos podem escapar à coleta.

Resultado reproduzível: **49/50 `nao_observado`, 1/50 `nao_verificado` (Cappei), 0/50 identificadas positivamente**. Zero identificadas é contagem de evidências positivas, não prova de que 50 páginas completas não apresentam a promessa. O registro individual traz URL, data e ressalvas por marca; a síntese usa esse escopo. Japa distingue onboarding de 3 dias; Nexio oferece teste de 3 dias. Cappei permanece parcialmente verificada nesta rodada, embora diagnóstico e protótipo antes do código tenham sido recuperados.

## Reprodução

Executar `python docs/mercado/2026-10-agencias-software/validar.py`. O programa verifica correspondência exata das 50 marcas, estados, fontes, teto conservador e contagens de promessa. Não comprova conteúdo remoto nem substitui revisão factual humana. A pendência do recorte qualitativo para países desconhecidos permanece explícita.
