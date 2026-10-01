# Rodada 2 — verificação documental complementar

**Verdict: needs_verification.** 5/7 PASS; T3:3 e T3:6 seguem parciais. A pesquisa pode ser entregue como base exploratória com limites auditáveis; esta conclusão não é bloqueio do código nem autorização de produção.
**Profile:** light. **Round:** 2 — scoped. **HEAD:** fcd6c6bd3e7debfdf8757e6044f3f2119ad68432. **Diff revisto:** b23932e0..fcd6c6bd, docs/mercado. **Data:** 2026-10-01.

## Provas e herança

Validador completo reexecutado no novo HEAD, exit 0. Assertions antigas e contagens permanecem verdes. `validar.py:60–61` comprova as mesmas 50 marcas e ordem; :63–67 verifica estados/campos/fontes; :70 `assert upper <= 10` confere teto 10. Saída: Brasil 40, Uruguai 1, Estados Unidos 1, desconhecido 8; promessa 49 nao_observado e 1 nao_verificado.

T3:1, T3:2 e T3:4: **PASS**, análise carregada de b23932e0; proofs reexecutados em fcd6c6bd. A base principal não mudou. O novo CSV foi lido integralmente, sem contatos ou nomes de pessoas. T3:5 e T3:7: **PASS**, revisão do diff e da síntese em fcd6c6bd, com cinco seções/pares de listas e oito hipóteses preservados; contagens do apêndice coerentes. A amostra de ofertas/preços da rodada 1 permanece carregada de b23932e0.

## T3:3 — needs_verification

A lacuna de ausência de registro geográfico foi resolvida: `auditoria-por-marca.csv:2–51` informa evidência, URL e modo de recuperação individual. `apendice-auditoria.md:7–13` limita corretamente a inferência: evidência de empresa brasileira, não operação exclusivamente brasileira; desconhecido não equivale a estrangeiro. O teto **2 + 8 = 10** é aritmeticamente correto sobre os estados registrados, mas sua prova factual ainda é amostral nesta revisão independente.

Amostra complementar aberta nesta rodada confirma:

- [ReplyAgent Contato](https://www.replyagent.com/pt-br/contact-us/): sede nos Estados Unidos; condição white-label para agências já corroborada na rodada 1.
- [DreamDesk Termos](https://dreamdesk.app/use-terms): empresa operadora com sede em Franca/SP.
- [Virtus Privacidade](https://crmvirtus.com/privacidade): declaração da sede empresarial.
- [WiseData Termos](https://www.wisedataagency.com/termos-de-uso): declaração da licenciante brasileira.
- [CodeIA Sobre](https://codeia.com.br/sobre): declaração de empresa brasileira.

Bioma/Abstract/Frelo/Otto/Cappei e respectivas provas geográficas da rodada 1 são carregadas de b23932e0. Sem contradições encontradas na amostra complementar. Não foi realizada auditoria independente das 40 declarações brasileiras.

O join dos oito países desconhecidos com o CSV principal revela **cinco marcas sem white-label declarado**: AutoAgencia, Nexio System, Aurabit, Galáxia Digital e GVD Soluções. Para estas, confirmar Brasil ou white-label para agências continua necessário ao fechamento integral do recorte. Web4Business, Datalitics e Vision Developer já têm `sim` no CSV; isso reduz a pendência qualitativa a cinco, sem resolver a revisão factual integral.

## T3:6 — needs_verification, com lacuna de rastreabilidade resolvida

`auditoria-por-marca.csv:2–51` agora registra a promessa individualmente; `sintese.md:59` distingue **49 nao_observado, 1 nao_verificado (Cappei), 0 identificações positivas**. O método em `apendice-auditoria.md:17–19` exclui trial/onboarding/orçamento e limita a busca ao texto recuperado. Essa formulação é metodologicamente honesta e a contagem é reproduzível; deixou de sugerir leitura conclusiva de 50 páginas completas.

Mantém-se parcial porque Cappei não foi verificada integralmente e a evidência remota das 49 linhas não foi reaberta integralmente pelo verificador. Os cinco comparáveis e seus motivos continuam corroborados pela rodada 1. Não exigir prova de inexistência universal no site/mercado: ela não é reivindicada pela síntese. O dado entregue é ausência de identificação nesta coleta limitada.

## Limites restantes e encerramento desta rodada

- Fechamento formal de T3 depende da evidência factual integral e do recorte qualitativo das cinco marcas acima; a entrega exploratória não deve ser anunciada como 7/7 verificada.
- As contagens exibidas são conferidas nesta revisão; o validador imprime as contagens e não faz assertion de equivalência com cada numeral na prosa, portanto revisão humana continua necessária após atualizações.
- Meta/Google permanecem 50/50 nao_verificado, corretamente; sem inferências de anúncios.
- Roteiro dot: análise carregada de b23932e0, PASS documental; T1:6–8 em produção permanecem não executados nesta revisão.
- Sem fault injection no perfil light. Nenhum código, CSV ou documento de pesquisa alterado pelo verificador; apenas este relatório, sem commit.

A seção abaixo preserva a rodada 1 como histórico; seus achados de falta de registro geográfico/registro individual da promessa foram substituídos pelas conclusões acima.

---
# Mercado de agências/software — verificação independente

**Verdict: needs_verification** — 5/7 critérios PASS; T3:3 e T3:6 parcialmente comprovados, com lacuna factual explícita.
**Profile:** light. **Round:** 1, full. **Verifier:** subagente independente, não autor.
**HEAD verificado:** b23932e07c78e661c0aa0c1832f31cbfb459c1b2. **Diff:** d96894e3^..b23932e0, limitado aos seis arquivos documentais desta entrega. Pesquisa introduzida em d96894e3.
**Data:** 2026-10-01.

## Provas executadas

`python docs/mercado/2026-10-agencias-software/validar.py` executado nesta revisão: exit 0. 50 linhas, 50 domínios, 17 colunas; tipos 12/15/23; white-label 24 sim/26 nao_informado; ambas as redes 50 nao_verificado; preço com R$ 13; LinkedIn 2; temas 4. Leitura integral do CSV, síntese, checks, relatório, validador e roteiro. Nenhum teste nomeado inexistente: o proof é o próprio script com assertions localizadas abaixo.

| Critério | Prova e evidência localizada | Resultado |
|---|---|---|
| T3:1 | validar.py:20 `reader.fieldnames == FIELDS`; :22 `len(rows) >= 50`; :37 `len(domains) == len(set(domains))`; CSV:1–51 lido integralmente, uma marca por linha | PASS |
| T3:2 | validar.py:27 `row[field] in allowed`; ENUMS :11–17 contém os conjuntos exatos do plano | PASS |
| T3:3 | validar.py:32 apenas prova URL; marcas.csv:2–51 contém fontes/lacunas. Amostra pública abaixo corrobora ofertas/preços, mas não cobre todos os campos das 50 linhas; geografia ainda sem prova suficiente | needs_verification |
| T3:4 | validar.py:35–36 regex de e-mail/telefone; revisão integral marcas.csv:2–51 não encontrou pessoas nem contatos. Nomes comerciais como Japa Gestão e SalomaoTech são marcas, não funcionários | PASS |
| T3:5 | validar.py:44, :47–48 verifica seções e cinco rótulos de cada lista; sintese.md:11–63 revisada. Contagens reproduzidas pelo script, incluindo 13 preços, 4 temas, distribuição dos CTAs e categorias. Métodos/limites não são observações estatísticas | PASS |
| T3:6 | sintese.md:57–59 traz 24/50 e 0/50 e cinco comparáveis motivados; 24 reproduzido do CSV, cinco fontes corroboradas abaixo. `0/50` não tem campo dedicado, assertion ou registro individual de busca da promessa nas 50 fontes; amostragem não prova essa ausência universal | needs_verification |
| T3:7 | validar.py:46 impõe 1–10 perguntas; sintese.md:68–75 tem 8 perguntas, cada uma com contagem e métrica; eventos ausentes são explicitamente indisponíveis | PASS |

## Amostra factual pública

Fontes abertas pela ferramenta web, sem login ou submissões. Foram examinadas 12 marcas, incluindo cinco comparáveis, geografia internacional e preços com risco de confusão entre licença/adicional/revenda. Não significa auditoria factual das 50.

- [Bioma](https://www.biomadigital.com/partners.html): página identifica estúdio uruguaio e white-label para agências; oferta e call/modelos comerciais conferem (linhas web 4, 47–74).
- [ReplyAgent](https://www.replyagent.com/pt-br/white-label/): duas camadas de marca, conta grátis e workspaces conferem (3–71). Rodapé identifica Connecta Group Corporation, sem país nessa página; não inferir nacionalidade da tradução.
- [Abstract Devs](https://abstractdevs.com.br/br/servicos/white-label): engenharia white-label, NDA, protótipo, decisões e São Paulo conferem (5–11, 227–265, 329).
- [Sistelia](https://sistelia.com.br/parcerias): white-label/NDA e WordPress a partir de R$ 2.500 conferem (40–50, 81–83). Exemplo de margem não confundido com tabela geral.
- [Otto.dev](https://letsotto.dev/parceria-agencias): escopo/proposta white-label, manutenção e propriedade conferem (120–122, 181–196); Sorocaba confirmada no rodapé.
- [Frelo](https://frelo.co/pt): Brasil e São Paulo, parceria, escopo/prazo fixos e call antes do orçamento conferem (8–17, 44–46, 160–161, 221).
- [Cappei](https://cappei.com/): duas aberturas diretas deram erro interno; a busca web pelo domínio retornou conteúdo público da própria página confirmando PME, diagnóstico, protótipo, código do cliente e São Paulo/São Carlos. Essa recuperação corrobora o motivo do comparável, mas não é leitura direta completa independente do fluxo.
- [Japa Gestão](https://japagestao.com.br/white-label/): R$ 997 até 20 contas e R$ 35 adicionais conferem (54–59); formulário/demonstração/proposta/contrato conferem (83–89).
- [Virtus](https://crmvirtus.com/crm-white-label-para-agencias): R$ 100/mês é adicional de domínio, não preço da licença (91).
- [iGeriu](https://www.igeriu.com.br/whitelabel-para-agencias): simulador explicita custo R$ 29,90/licença (178); ressalva de condições desconhecidas é adequada.
- [Aihoo](https://aihoo.app/white-label): white-label e piso R$ 9.980/mês conferem (3–13).
- [WiseData](https://www.wisedataagency.com/gestao-para-agencias-de-marketing): valores Free/Basic/Enterprise conferem (145–146).

## Lacunas acionáveis

1. **Geografia — needs_verification.** `Import-Csv` contou 27/50 cidades nao_informado. Não existe registro por marca de país/evidência geográfica. A fonte permite confirmar Bioma internacional white-label e algumas brasileiras, mas não fechar a regra do plano de no máximo 10 internacionais. Cidade desconhecida não prova país estrangeiro, nem domínio .br prova sede brasileira. Registrar auditoria geográfica em documento auxiliar, mantendo as 17 colunas, ou confirmar ao menos 40 brasileiras e justificar cada internacional restante. O próprio relatorio.md:21 reconhece essa pendência.
2. **Cobertura factual T3:3/T3:6.** A prova automatizada é estrutural; não valida conteúdo de fontes. Para fechar integralmente, registrar conferência por marca dos campos preenchidos e da busca pela promessa conjunta; manter lacunas explícitas onde a fonte não sustenta. O `0/50` está corretamente qualificado como ausência de identificação, mas ainda depende do autor para 38 marcas fora desta amostra.
3. **Classificação do CTA (melhoria de precisão, não FAIL):** Otto tem CTA de parceria em link WhatsApp e foi classificada `outro`; o critério por intenção descrito no método permite isso, porém o dot não deve interpretar a contagem `whatsapp` como todos os links que levam ao WhatsApp.

Nenhuma evidência contraditória foi encontrada nas ofertas/preços amostrados. Não há justificativa para substituir nao_verificado por sim/nao nos anúncios. O acesso às bibliotecas relatado pelo autor não foi usado como prova de anúncio nem precisa sê-lo para registrar desconhecido.

## Roteiro dot e limites

`roteiro-dot.md:1–54` cobre convite/entrada, conciliação 7d e desligar/religar, com status NÃO EXECUTADO e evidências sanitizadas. PASS como roteiro; T1:6–8 de produção continuam **needs_verification**, sob coordenação do root e execução autorizada. Nenhuma conta, integração, banco, deploy, envio, sessão LinkedIn, arquivo .env ou segredo foi acessado nesta revisão.

Perfil light: sem fault injection; Coverage/Test policy formais ausentes, portanto nenhum join ou veredicto de política adicional. Swept existente não reivindica mecanismos de código; revisado como escopo documental. Nenhuma pesquisa ou código alterado; só este relatório foi criado, sem commit.

