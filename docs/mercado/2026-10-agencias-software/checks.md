# Checks — mercado e roteiro do dot

Perfil: light. Autor: agente D, coordenador Codex. Data: 2026-10-01.
Fontes: tarefas integrais mercado-agencias-software.md (T3), hub-marketing-fechar-movimento.md (T1) e acompanhamento.md na branch de integração; páginas públicas citadas no CSV.

## Landing

Documento reversível; nenhuma porta sem volta. Checklist nesta pasta por limite de propriedade do agente.
Não contam como prova de anúncio pixels, logos de integrações, menção a Ads nem resultados de busca. Fluxos descrevem só o trecho público, sem submeter formulário.
Tipo classifica a oferta observada: serviço de desenvolvimento sob marca do parceiro = fabrica_white_label; licença de plataforma para agência = saas_para_agencias; desenvolvimento sob medida = software_house.

## Checks

### Base de marcas

- T3:1: >=50 marcas, domínios únicos, 17 colunas na ordem da tarefa. Prova: python docs/mercado/2026-10-agencias-software/validar.py.
- T3:2: enums exatos. Prova: mesmo comando, assertions de enums.
- T3:3: fonte pública em cada linha, lacunas explícitas; anúncios só biblioteca oficial. Prova estrutural: mesmo comando; prova factual: leitura das URLs por marca e revisão independente; URL presente sozinha não prova o conteúdo.
- T3:4: nenhum nome de pessoa ou contato armazenado. Prova: revisão integral do CSV e varredura de contatos no mesmo comando; regex não prova ausência de nomes próprios.

### Síntese

- T3:5: cinco seções pedidas, contagens reproduzíveis, listas Observações/Hipóteses separadas. Prova: mesmo comando para contagens e seções; revisão textual independente.
- T3:6: contagem de white-label e da promessa conjunta roadmap/protótipo em 3 dias; até cinco comparáveis com fonte e motivo. Prova: contagem CSV + revisão textual das fontes.
- T3:7: até dez perguntas finais, todas com contagem e métrica. Prova: mesmo comando para limite e revisão das perguntas.

### Roteiro

- T1:6–8: documento com convite/entrada, conciliação e matriz de acesso/desligar/religar; status não executado até G3. Prova: revisão roteiro-dot.md. A prova de produção dos critérios permanece do coordenador/Lucca.

## Swept

- validation: T3:1–2.
- failure modes/dependência externa: T3:3; indisponível é lacuna, nunca dado inventado.
- idempotência/retry: coleta única datada; revisão das mesmas URLs não cria outra marca.
- autorização: somente páginas públicas; T1 é roteiro, sem criação de conta.
- concorrência/ordem: coletor único; ordenação por tipo e nome.
- ciclo de dados: somente dados empresariais, T3:4.
- estados: nenhuma mudança de estado; roteiro declara estados esperados.
- observabilidade: fontes e data em cada linha, limitações no relatório.

## Handoff

Um lote documental; leitura dos planos ~12k tokens, fontes públicas variável <100k tokens. Sem subagentes do construtor. Coordenador despacha verificador independente após integração.

## Fora do escopo

Contatos ativos, contas, sessões privadas, anúncios pagos, escrita no app/banco, scraping de SERP, pessoas, deploy, push e PR.
