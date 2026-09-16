# F2-10 — Editor e Skill 03

## Verificação local — 16/09/2026

- [x] C1: texto, tamanho, cor e logo persistem após salvar e recarregar (Vitest e E2E desktop/mobile).
- [x] C2: allowlist por versão; controles ocultos e validação no banco impedem atributos não liberados.
- [x] C3: referência da build permanece imutável; preview usa origem, janela-pai, projeto, versão e componentes explícitos.
- [x] C4: download dos quatro arquivos e upload no bucket privado, com manifesto e hash de conteúdo.
- [x] C5: novo request com o mesmo conteúdo recupera o export e checklist originais; não duplica objetos.
- [x] C6: versão-base antiga é aceita com conflito sinalizado (pgTAP).
- [x] C7: ficha administrativa mostra status e antes/depois agrupados; ingestão cria um item Kanban por grupo.
- [x] C8: ingestão transacional avança para ALTERACOES_RECEBIDAS e registra um evento idempotente.
- [x] C9: associação à versão posterior aparece no histórico CLIENT, incluindo antes/depois.
- [x] C10: cenário B completo — converter → V1 → editar/salvar/reload/enviar → checklist → V2 → V3 → concluir — passou nas duas larguras.
- [x] C11: Vitest 105/105, lint e build/TypeScript aprovados; testes Supabase locais e E2E de regressão Onda 2/3 8/8.

## Proteções adicionais verificadas

- Pacote só pode ser ingerido depois de finalizar a existência dos quatro objetos privados no Storage.
- Upload imutável sem upsert; acesso condicionado ao projeto, conteúdo registrado e nomes de arquivo permitidos.
- Caminho inválido/outro tenant, controle não autorizado e logo não HTTPS são rejeitados.
- Reutilização de request de ingestão/associação com outro export/versão é rejeitada.
- Rascunho é preservado antes da chamada de rede e filtrado contra a allowlist ao restaurar.
- O runtime `app/public/no-editor-preview.js` é opt-in para builds de preview marcadas; não foi injetado na home nem em builds reais de clientes.

## Evidências

- `supabase/tests/f2_10_editor.test.sql`: testes transacionais de C2–C9, autorização, conflito e Storage.
- `app/src/editorModule.test.tsx`, `adminDashboard.test.tsx`, `clientDashboard.test.tsx`: testes de componentes, reload, erro, preview e associação.
- `app/e2e/f2-10-editor.spec.ts`: cenário B completo, quatro downloads/objetos, replay e imutabilidade.
- Playwright regressão `R1-07|F2-09|F3-11|F2-10`: 8/8, 55,1 s.
- As execuções interrompidas para corrigir seletores e sincronização do teste não constituem provas PASS; o resultado final acima é fresco.

## Operação posterior

- A Nó configura por versão os componentes e controles liberados; a lista vive em `editor_version_configs`.
- Integrar o bridge apenas nos previews de cada cliente, com os identificadores corretos, antes de habilitar `bridge_enabled`.
- Aplicação das alterações no código do cliente continua sendo trabalho da Nó na próxima entrega, conforme o escopo aprovado.
- Produção e rotação do PAINEL_TOKEN são acompanhadas em R1-08; provas locais não equivalem a go-live.

## Demonstração em produção — Completo e V1 — 16/09/2026

- [x] Titular entrou na conta CLIENT em sessão separada do NO_ADMIN; nenhuma senha ou sessão foi lida/registrada. Preferência Completo salva pela interface CLIENT e confirmada no banco.
- [x] Pelo painel NO_ADMIN: termos demonstrativos com amount_cents=0, forma/status/observações explicitamente SIMULACAO; conversão e fluxo CONVERTIDO → AGENDADO → V1_EM_DESENVOLVIMENTO → V1_PUBLICADA. Acesso ATIVO_ATE_FIM_DO_PROJETO, sem aviso de expiração de 15 dias no CLIENT.
- [x] Uma V1 demonstrativa atual, com changelog explicitando ausência de nova entrega no Discordia. Referência registrada: discordia-demo@816d3845782c89e4d9c618fa9c69fb5aa99716c6; não equivale a deploy novo do case.
- [x] Publicação ativou Editor/Versões mantendo os demais módulos, inclusive Marca já ativada pelo titular. Uma configuração de Editor por V1 e uma atividade demo.editor_configured; inserção restrita ao projeto/versão, sem sobrescrever configuração existente.
- [x] Allowlist de quatro componentes demonstrativos da entrada: título/subtítulo com texto/tamanho/cor, botão com texto/cor e logo com URL. bridge_enabled=false: sem postMessage/injeção no Discordia real; este exercício valida formulário/rascunho, não preview visual do case.
- [x] Na sessão CLIENT real: histórico mostrou V1 publicada/Atual; Editor · V1 carregou quatro grupos e apenas controles liberados. Título demonstrativo e tamanho 24 salvos; ambos permaneceram após reload.
- [x] CLIENT recebeu Acesso não autorizado ao tentar /no/projetos; lista própria mostrou somente o projeto esperado. Editor ficou aberto para validação conjunta, preservando o rascunho.
- [x] Consulta final: CONVERTIDO/V1_PUBLICADA/completo; todos os seis módulos ativos; uma versão/uma atual; valor contratual zero; somente o pagamento original approved de 14990 centavos, exports=0. Sem nova cobrança, recebimento fictício, submissão de pacote ou mudança no Discordia.
- [ ] Preview visual controlado deste case exige build de preview opt-in própria; não habilitar bridge apontando para o Discordia real sem integrar o runtime/identificadores e testar. Envio/Storage/ingestão desta conta real não foram exercitados nesta demonstração.

Não houve mudança de código/schema neste exercício; testes automatizados não foram repetidos. Resultados anteriores 152/152 do app e 25/25 da liberação permanecem históricos, não execuções novas.
