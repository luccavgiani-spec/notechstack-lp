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
