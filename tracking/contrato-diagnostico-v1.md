# Contrato do diagnóstico do Auditor — v1

Fonte única para a LP `/agentes/auditor/` (navegador) e a função `diagnostico-auditor` (servidor).
Mudou um campo, sobe a versão (`v`) e os dois lados mudam juntos.

## Pedido: navegador → `POST {SUPABASE_URL}/functions/v1/diagnostico-auditor`

```json
{
  "v": 1,
  "url": "https://site-da-pessoa.com.br",
  "event_id": "diag_<crypto.randomUUID()>",
  "consent": "granted | denied",
  "fbp": "_fbp", "fbc": "_fbc ou montado do fbclid", "fbclid": "...",
  "ga_client_id": "X.Y do cookie _ga",
  "utm": { "source": "", "medium": "", "campaign": "", "content": "", "term": "" },
  "page_url": "location.href da LP",
  "test_event_code": "opcional, só em teste"
}
```

- `event_id` nasce no clique em "Diagnosticar"; reenvio da mesma tentativa usa o mesmo id.
- Sem escolha no aviso de consentimento vale `denied`.
- Com `denied` o servidor grava o diagnóstico na base e não guarda nem envia `fbp`, `fbc`,
  `ga_client_id` nem IP a ninguém. O IP só entra como hash, para o limite.

## Respostas

| HTTP | corpo | tela da LP | evento no navegador |
|---|---|---|---|
| 200 | `{status:"entregue", cache:false, event_id, report}` | relatório | `fbq trackCustom DiagnosticoEntregue {eventID}` só com consentimento |
| 200 | `{status:"entregue", cache:true, ...}` | relatório + "resultado das últimas 24h" | idem |
| 200 | `{status:"entregue", duplicado:true, ...}` | relatório | nenhum (já contou) |
| 409 | `{status:"em_andamento"}` | carregando | — |
| 429 | `{status:"limite_usuario", limite:3}` | "você usou seus 3 diagnósticos gratuitos" + cadastro | `diagnostico_limite_usuario` (dataLayer) |
| 503 | `{status:"teto_diario"}` | estado próprio do teto | `diagnostico_teto_atingido` (dataLayer) |
| 400 | `{status:"erro", erro:"url_invalida"\|"event_id"\|"consent"\|...}` | URL inválida | — |
| 403 | `{status:"erro", erro:"origem_nao_permitida"}` | falha | `diagnostico_falha` (dataLayer) |
| 502 | `{status:"falha", erro:"site_inacessivel"}` | falha; nova tentativa ganha `event_id` novo | `diagnostico_falha` (dataLayer) |
| 500 | `{status:"erro", erro:"interno"}` | falha | `diagnostico_falha` (dataLayer) |

Reenvio com o mesmo `event_id` só quando a resposta não chegou (erro de rede). Depois de uma
resposta 502, o `event_id` daquela tentativa fica como `falha` para sempre.

`report = {url, gerado_em, checagens:[{id, titulo, status:"ok|atencao|problema|nao_verificavel", evidencia, recomendacao}], resumo:{ok, atencao, problema, nao_verificavel}}`.

## Quem conta o quê

- **Base (Supabase):** `diag_eventos.event_id` é chave primária: o mesmo id conta uma vez. Conta todo
  diagnóstico, com ou sem consentimento. `diag_contagem_diaria` mostra a diferença base × consentidos.
- **Meta:** navegador (`fbq`) e servidor (CAPI, dentro da `diagnostico-auditor`) mandam
  `DiagnosticoEntregue` com o mesmo `event_id`; a Meta deduplica. A `meta-capi` pública recusa esse
  evento com 400 (lista fechada).
- **GA4:** `diagnostico_entregue` só pelo servidor (Measurement Protocol). O navegador não manda,
  porque o GA4 não deduplica navegador × servidor.
- **Teto batido:** a função grava em `diag_alertas` e manda e-mail ao Lucca uma vez por dia.
