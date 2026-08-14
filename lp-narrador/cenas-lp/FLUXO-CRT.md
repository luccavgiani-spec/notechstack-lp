# Fluxo do CRT — árvore de diálogo do "Senta aí"

Fonte da verdade visual do `SCRIPT` de `lp-v5.html`. Espelha o board do Miro
(`nó · fluxo do CRT (LP v5)`); quando o `SCRIPT` mudar, os dois mudam na mesma leva.

Cor por nicho, igual ao `CRT_ACC` do arquivo: azul = e-commerce · verde = saúde ·
vermelho = comunicação · amarelo = apps · branco = neutro. O 🔗 marca as folhas com
`site:true`, em que o endereço faz parte do diagnóstico.

---

## 1 · A teia (reestruturada em 14/08/2026)

```mermaid
flowchart TD
    classDef entrada fill:#dedaff,stroke:#6631d7
    classDef menu fill:#e7e7e7,stroke:#595959
    classDef ecom fill:#c6dcff,stroke:#305bab
    classDef saude fill:#adf0c7,stroke:#087429
    classDef com fill:#ffc6c6,stroke:#bd0909
    classDef apps fill:#fff6b6,stroke:#af7e02
    classDef neutro fill:#ffffff,stroke:#757575
    classDef ponte fill:#c3faf5,stroke:#187574
    classDef form fill:#ccf4ff,stroke:#108ab3
    classDef fim fill:#dbfaad,stroke:#608520
    classDef fuga fill:#ffd8f4,stroke:#af3fb9

    E1(["ENTRADAS · 4 portas pro mesmo monitor<br>hero · CTA final · atalho armOption · deep-link #pouso"]):::entrada
    E2["abrirDiagnostico → queda → pouso → zoom no monitor"]:::entrada
    NAV["NAVBAR · ← voltar · TRILHA ao vivo · ⌂ início · próximo →"]:::entrada

    R{"RAIZ · separada por INTENÇÃO, não por sintoma"}:::menu
    A1["tirar uma ideia do papel — ainda não existe"]:::menu
    A2["vender mais — já funciona, quero escalar"]:::menu
    A3["tenho algo no ar que não performa"]:::menu
    A4["organizar a operação e ganhar tempo"]:::menu

    M1{"r_comecar · 'e essa ideia hoje é mais...'"}:::menu
    M2{"r_crescer · 'de que vive esse negócio hoje?'"}:::menu
    M3{"r_destravar · 'o que está no ar e não performa?'"}:::menu
    M4{"r_operar · 'o que mais toma seu tempo hoje?'"}:::menu

    SM1{"r_com_aberto · 'o que você já tem na mão?'"}:::menu
    SM2{"r_saude · 'tem corpo clínico?'"}:::saude
    SM3{"r_servico · 'o gargalo do serviço está mais em...'"}:::apps

    L1["f_com_produto"]:::ecom
    L2["f_com_app"]:::apps
    L3["f_com_publico"]:::com
    L4["f_com_canal"]:::ecom
    L5["f_com_intuicao"]:::neutro
    L6["f_cres_produtos"]:::ecom
    L7["f_cres_conteudo"]:::com
    L8["f_saude_clinico"]:::saude
    L9["f_saude_roteador"]:::saude
    L10["f_serv_agenda"]:::apps
    L11["f_serv_entrega"]:::apps
    L12["f_serv_financeiro"]:::ecom
    L13["f_dest_conversao 🔗"]:::com
    L14["f_dest_trafego 🔗"]:::com
    L15["f_dest_numeros 🔗"]:::com
    L16["f_dest_sistema 🔗"]:::apps
    L17["f_op_atendimento"]:::com
    L18["f_op_planilhas"]:::apps
    L19["f_op_integracao"]:::apps

    ESC["escape · 'nenhuma dessas'<br>pula a ponte e vai direto ao formulário"]:::fuga

    P{"PONTE · fechamento DA FOLHA (node.close)"}:::ponte
    MA["PROVA DA FOLHA (node.prova)"]:::ponte
    AL{"ALINHAMENTO · 'faz sentido pra você?'"}:::ponte

    F1["FORM 1 · trilha + prefácio + descrição<br>🔗 aqui o campo SITE sobe e vira obrigatório"]:::form
    F2["FORM 2 · 'quando você quer começar?' · 3 chips, um toque"]:::form
    F3["FORM 3 · nome · e-mail · whatsapp · site"]:::form
    F4(["recebido ✓"]):::fim
    SB[("Supabase · send-lead-email")]:::fim

    E1 --> E2 --> R
    NAV -.-> R
    R --> A1 & A2 & A3 & A4
    A1 --> M1
    A2 --> M2
    A3 --> M3
    A4 --> M4
    M1 --> L1 & L2 & SM1
    SM1 --> L3 & L4 & L5
    M2 --> L6 & L7 & SM2 & SM3
    SM2 --> L8 & L9
    SM3 --> L10 & L11 & L12
    M3 --> L13 & L14 & L15 & L16
    M4 --> L17 & L18 & L19
    M1 -->|nenhuma dessas| ESC
    M2 -->|nenhuma dessas| ESC
    M3 -->|nenhuma dessas| ESC
    M4 -->|nenhuma dessas| ESC
    L1 & L2 & L3 & L4 & L5 & L6 & L7 & L8 & L9 & L10 & L11 & L12 & L13 & L14 & L15 & L16 & L17 & L18 & L19 --> P
    P -->|sim, é por aí| F1
    P -->|me conta mais| MA --> AL
    P -->|prefiro falar com alguém agora| F3
    AL -->|sim, bora| F1
    AL -->|outra opção daqui| M1
    AL -->|errei o caminho, voltar ao início| R
    ESC --> F1
    F1 --> F2 --> F3 --> F4 --> SB
```

---

## 2 · As 10 brechas e o que foi feito

| # | Como era | O que passou a ser |
|---|---|---|
| 1 | ponte com a MESMA frase pras 14 folhas | `close` por folha, citando o que a pessoa escolheu |
| 2 | "me conta mais" com institucional único | `prova` por folha: o COMO a nó faz aquilo |
| 3 | "não é bem isso" só voltava ao RAMO | alinhamento com 3 saídas, incluindo voltar ao início |
| 4 | todo caminho terminava no formulário | saída lateral "prefiro falar com alguém agora" |
| 5 | `r1_servicos` era balde de lixo sem parede | virou sub-menu `r_servico` com 3 gargalos |
| 6 | `r2_naosei` devolvia a resposta mais curta | virou sub-menu `r_com_aberto` |
| 7 | "etapa X de 5" mentia em quase todo caminho | **barra excluída**; entrou a TRILHA ao vivo |
| 8 | opção 3 da raiz era sub-caso da opção 1 | raiz reescrita por INTENÇÃO |
| 9 | diagnosticava site sem pedir o endereço | campo `site`, que sobe pra tela 1 nas folhas 🔗 |
| 10 | nenhum sinal de tamanho | tela "quando você quer começar?" (prazo, não R$) |

## 3 · Contrato do lead (o que dá pra mudar sem tocar no backend)

A edge function `send-lead-email` desestrutura **oito campos fixos** e grava exatamente
esses. Chave fora da lista é descartada **em silêncio** — foi o que sempre aconteceu com
o `path` que a v4 mandava: nunca chegou ao banco nem ao e-mail. Por isso o front empacota
tudo dentro dos oito:

| campo | recebe |
|---|---|
| `contexto` | a intenção da raiz (+ ` · QUER FALAR AGORA`, que aparece no assunto) |
| `objetivos` | o caminho completo da árvore — é o antigo `path`, agora persistido |
| `prazo` | quando quer começar (tela 2) |
| `investimento` | vazio — faixa de R$ saiu da jornada de propósito |
| `aiAnalysis` | bloco legível: leitura da nó + site + descrição + marcas de modo |

**Pendência de backend** (fora do escopo de front): dar colunas próprias a `site`,
`descricao` e `path`, e parar de empacotar dentro de `aiAnalysis`.
