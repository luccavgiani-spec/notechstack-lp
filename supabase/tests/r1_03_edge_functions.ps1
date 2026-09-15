[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$supabase = (Get-Command supabase -ErrorAction Stop).Source
$node = (Get-Command node -ErrorAction Stop).Source
$mockPort = 54327
$mockAdmin = "http://127.0.0.1:$mockPort"
$tempEnv = [IO.Path]::GetTempFileName()
$serveOut = [IO.Path]::GetTempFileName()
$serveErr = [IO.Path]::GetTempFileName()
$mockOut = [IO.Path]::GetTempFileName()
$mockErr = [IO.Path]::GetTempFileName()
$serveProcess = $null
$mockProcess = $null
$passes = [System.Collections.Generic.List[string]]::new()
$script:runId = [guid]::NewGuid().ToString('N').Substring(0, 12)

function Get-StatusValue([string[]]$Lines, [string]$Name) {
  $match = $Lines | Select-String -Pattern ('^' + [regex]::Escape($Name) + '="([^"]+)"$') | Select-Object -First 1
  if (-not $match) { throw "Supabase local status did not return $Name" }
  return $match.Matches[0].Groups[1].Value
}

function Invoke-Json([string]$Method, [string]$Uri, $Body = $null, [hashtable]$Headers = @{}) {
  $params = @{
    UseBasicParsing = $true
    SkipHttpErrorCheck = $true
    Method = $Method
    Uri = $Uri
    Headers = $Headers
  }
  if ($null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
  }
  $response = Invoke-WebRequest @params
  $parsed = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
  return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $parsed }
}

function Assert-True([bool]$Condition, [string]$Label) {
  if (-not $Condition) { throw "ASSERTION FAILED: $Label" }
  $passes.Add($Label)
}

function Get-Rows([string]$TableAndQuery) {
  $response = Invoke-WebRequest -UseBasicParsing -Uri "$script:apiUrl/rest/v1/$TableAndQuery" -Headers $script:restHeaders
  if (-not $response.Content) { return @() }
  return @($response.Content | ConvertFrom-Json)
}

function New-Lead([string]$Context, [string]$Suffix) {
  $sid = "r103-$Suffix-" + [guid]::NewGuid().ToString('N').Substring(0, 12)
  $body = @{
    nome = "Lead $Suffix"
    email = "$Suffix@example.test"
    whatsapp = '(11) 99999-0000'
    contexto = $Context
    sid = $sid
    objetivos = 'Objetivo legado'
  }
  $result = $null
  foreach ($attempt in 1..4) {
    $result = Invoke-Json 'POST' "$script:apiUrl/functions/v1/send-lead-email" $body
    if ($result.Status -eq 200 -and $result.Body.saved -and $result.Body.leadId) { break }
    Start-Sleep -Milliseconds 500
  }
  Assert-True ($result.Status -eq 200 -and $result.Body.saved -and $result.Body.leadId) "C16 send-lead-email grava contexto $Context"
  return [pscustomobject]@{ Id = [string]$result.Body.leadId; Sid = $sid }
}

function Checkout($Lead, [string]$Method, [string]$Token = '') {
  $body = @{
    leadId = $Lead.Id
    sid = $Lead.Sid
    metodo = $Method
    amount_cents = 1
    answers = @{
      objetivo = 'Lançar produto'
      negocio = 'SaaS'
      publico = 'PMEs'
      ferramentas = 'Planilhas'
      resultado = 'MVP publicado'
    }
  }
  if ($Token) { $body.cardToken = $Token }
  return Invoke-Json 'POST' "$script:apiUrl/functions/v1/roadmap-checkout" $body
}

function Set-Scenario([string]$Create, [string]$Confirm, [int]$HttpStatus = 200) {
  $null = Invoke-Json 'POST' "$mockAdmin/__scenario" @{ createStatus = $Create; confirmStatus = $Confirm; httpStatus = $HttpStatus }
}

function Set-OrderStatus([string]$OrderId, [string]$Status) {
  $null = Invoke-Json 'POST' "$mockAdmin/__order-status" @{ id = $OrderId; status = $Status }
}

function Invoke-Webhook([string]$EventId, [string]$Type, [string]$OrderId, [string]$Auth = $script:validBasic) {
  $headers = if ($Auth) { @{ Authorization = $Auth } } else { @{} }
  $eventStatus = if ($Type -like '*.paid') { 'paid' } elseif ($Type -like '*canceled*' -or $Type -like '*expired*') { 'canceled' } else { 'failed' }
  $eventData = if ($Type.StartsWith('charge.')) {
    @{ id = "ch-event-$EventId"; status = $eventStatus; order = @{ id = $OrderId } }
  } else {
    @{ id = $OrderId; status = $eventStatus }
  }
  return Invoke-Json 'POST' "$script:apiUrl/functions/v1/pagarme-webhook-no" @{
    id = $EventId
    type = $Type
    data = $eventData
  } $headers
}

try {
  $statusLines = & $supabase status -o env 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Supabase local stack is not available' }
  $script:apiUrl = Get-StatusValue $statusLines 'API_URL'
  $serviceRoleKey = Get-StatusValue $statusLines 'SERVICE_ROLE_KEY'
  $script:restHeaders = @{ apikey = $serviceRoleKey; Authorization = "Bearer $serviceRoleKey" }
  $script:validBasic = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('r103-user:r103-pass'))

  [IO.File]::WriteAllText($tempEnv, @"
PAGARME_SECRET_KEY=sk_test_r103_local
PAGARME_WEBHOOK_USER=r103-user
PAGARME_WEBHOOK_PASS=r103-pass
PAGARME_API_URL=http://host.docker.internal:$mockPort
"@)

  $mockProcess = Start-Process -FilePath $node -ArgumentList @('supabase/tests/r1_03_pagarme_mock.mjs', "$mockPort") `
    -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $mockOut -RedirectStandardError $mockErr -PassThru
  $serveProcess = Start-Process -FilePath $supabase -ArgumentList @('functions', 'serve', '--no-verify-jwt', '--env-file', $tempEnv) `
    -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $serveOut -RedirectStandardError $serveErr -PassThru

  $deadline = [DateTime]::UtcNow.AddSeconds(60)
  do {
    if ($mockProcess.HasExited) { throw "Mock exited early with code $($mockProcess.ExitCode)" }
    if ($serveProcess.HasExited) { throw "Functions server exited early with code $($serveProcess.ExitCode)" }
    try {
      $warm = Invoke-Json 'POST' "$script:apiUrl/functions/v1/track-evento" @{ sid = 'r103-warmup'; eventos = @() }
      if ($warm.Status -eq 200) { break }
    } catch { }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)
  Assert-True ($warm.Status -eq 200) 'C17 Edge Functions locais ficam prontas'

  Set-Scenario 'pending' 'paid'
  $pixLead = New-Lead 'roadmap' 'pix'
  $pix = Checkout $pixLead 'pix'
  Assert-True ($pix.Status -eq 200 -and $pix.Body.status -eq 'pending') 'C3 Pix retorna pagamento pending'
  Assert-True ($pix.Body.pix.qrCode -like '000201-mock-*' -and $pix.Body.pix.qrCodeUrl -like 'https://mock.test/qr/*') 'C3 Pix retorna QR e copia-e-cola'
  $pixPayment = (Get-Rows "payments?lead_id=eq.$($pixLead.Id)&select=*")[0]
  Assert-True ($pixPayment.amount_cents -eq 14990 -and $pixPayment.method -eq 'pix' -and $pixPayment.status -eq 'pending') 'C3 pagamento Pix persiste 14990'
  $pixLeadRow = (Get-Rows "leads?id=eq.$($pixLead.Id)&select=nome,email,whatsapp,contexto,sid")[0]
  Assert-True ($pixLeadRow.nome -eq 'Lead pix' -and $pixLeadRow.email -eq 'pix@example.test') 'C3 lead roadmap preserva nome e email'
  Assert-True ($pixLeadRow.whatsapp -eq '(11) 99999-0000' -and $pixLeadRow.contexto -eq 'roadmap' -and $pixLeadRow.sid -eq $pixLead.Sid) 'C3 lead roadmap preserva WhatsApp contexto e sid'

  $pixAgain = Checkout $pixLead 'pix'
  Assert-True ($pixAgain.Body.paymentId -eq $pix.Body.paymentId -and $pixAgain.Body.pix.qrCode -eq $pix.Body.pix.qrCode) 'C8 duplo submit reutiliza pagamento e Pix'
  Assert-True ((Get-Rows "payments?lead_id=eq.$($pixLead.Id)&select=id").Count -eq 1) 'C8 existe um único pagamento aberto'

  $badSidBody = @{
    leadId = $pixLead.Id; sid = 'sid-incorreto'; metodo = 'pix';
    answers = @{ objetivo='a'; negocio='b'; publico='c'; ferramentas='d'; resultado='e' }
  }
  $badSid = Invoke-Json 'POST' "$script:apiUrl/functions/v1/roadmap-checkout" $badSidBody
  Assert-True ($badSid.Status -eq 403 -and $badSid.Body.error_code -eq 'LEAD_SESSION_MISMATCH') 'C7 leadId e sid divergentes retornam 403 tipado'
  Assert-True ((Get-Rows "payments?lead_id=eq.$($pixLead.Id)&select=id").Count -eq 1) 'C7 divergência não cria pagamento'

  $requests = (Invoke-Json 'GET' "$mockAdmin/__requests").Body
  $firstOrder = @($requests | Where-Object { $_.method -eq 'POST' })[0]
  Assert-True ($firstOrder.body.items[0].amount -eq 14990) 'C6 gateway recebe preço server-side 14990'

  $noAuthBefore = (Get-Rows 'payment_events?select=id').Count
  $missingAuth = Invoke-Webhook "$($script:runId)-noauth" 'order.paid' $pixPayment.gateway_order_id ''
  $wrongAuth = Invoke-Webhook "$($script:runId)-wrongauth" 'order.paid' $pixPayment.gateway_order_id 'Basic d3Jvbmc6d3Jvbmc='
  Assert-True ($missingAuth.Status -eq 401 -and $wrongAuth.Status -eq 401) 'C12 Basic ausente e incorreta retornam 401'
  Assert-True ((Get-Rows 'payment_events?select=id').Count -eq $noAuthBefore) 'C12 auth inválida não grava evento'

  $paidEventId = "$($script:runId)-paid-main"
  $paid = Invoke-Webhook $paidEventId 'order.paid' $pixPayment.gateway_order_id
  Assert-True ($paid.Status -eq 200 -and $paid.Body.status -eq 'approved') 'C10 webhook autenticado aplica pagamento aprovado'
  $approvedPayment = (Get-Rows "payments?id=eq.$($pix.Body.paymentId)&select=*")[0]
  $projectRows = Get-Rows "projects?lead_id=eq.$($pixLead.Id)&select=*"
  $projectId = [string]$projectRows[0].id
  $clientRows = Get-Rows "clients?email=eq.pix@example.test&select=id,name"
  Assert-True ($approvedPayment.status -eq 'approved' -and $approvedPayment.project_id -eq $projectId) 'C10 payment liga ao projeto aprovado'
  Assert-True ($clientRows.Count -eq 1 -and $clientRows[0].name -eq 'Lead pix') 'C10 cria cliente com o mesmo nome do lead'
  Assert-True ($projectRows.Count -eq 1 -and $projectRows[0].lead_status -eq 'ROADMAP_PAGO') 'C10 cria projeto ROADMAP_PAGO'
  Assert-True ((Get-Rows "roadmaps?project_id=eq.$projectId&select=*").Count -eq 1) 'C10 cria roadmap com answers'
  $items = Get-Rows "kanban_items?project_id=eq.$projectId&select=title,scheduled_date"
  Assert-True ($items.Count -eq 2 -and ($items.title -contains 'Dia 1 — referências') -and ($items.title -contains 'Entrega — seu dashboard')) 'C10 cria dois itens do Kanban'
  Assert-True (($items | Where-Object title -eq 'Dia 1 — referências').scheduled_date -eq '2026-09-15' -and ($items | Where-Object title -eq 'Entrega — seu dashboard').scheduled_date -eq '2026-09-17') 'C10 datas D+1/D+3 usam America/Sao_Paulo'
  Assert-True ((Get-Rows "activity_events?project_id=eq.$projectId&select=id").Count -eq 1) 'C10 cria uma atividade explícita'

  $vectorBefore = @(
    (Get-Rows "payment_events?payment_id=eq.$($pix.Body.paymentId)&select=id").Count,
    $clientRows.Count,
    $projectRows.Count,
    $items.Count,
    (Get-Rows "activity_events?project_id=eq.$projectId&select=id").Count
  ) -join ','
  $duplicate = Invoke-Webhook $paidEventId 'order.paid' $pixPayment.gateway_order_id
  $vectorAfter = @(
    (Get-Rows "payment_events?payment_id=eq.$($pix.Body.paymentId)&select=id").Count,
    (Get-Rows "clients?email=eq.pix@example.test&select=id").Count,
    (Get-Rows "projects?lead_id=eq.$($pixLead.Id)&select=id").Count,
    (Get-Rows "kanban_items?project_id=eq.$projectId&select=id").Count,
    (Get-Rows "activity_events?project_id=eq.$projectId&select=id").Count
  ) -join ','
  Assert-True ($duplicate.Status -eq 200 -and $duplicate.Body.idempotent -and $vectorBefore -eq $vectorAfter) 'C11 evento repetido não duplica efeitos'

  Set-Scenario 'pending' 'pending'
  $mismatchLead = New-Lead 'roadmap' 'mismatch'
  $mismatchCheckout = Checkout $mismatchLead 'pix'
  $mismatchPayment = (Get-Rows "payments?id=eq.$($mismatchCheckout.Body.paymentId)&select=*")[0]
  $mismatch = Invoke-Webhook "$($script:runId)-mismatch-main" 'order.paid' $mismatchPayment.gateway_order_id
  Assert-True ($mismatch.Status -eq 200 -and $mismatch.Body.reason -eq 'status_mismatch') 'C13 reconsulta divergente é registrada sem efeito'
  Assert-True ((Get-Rows "payments?id=eq.$($mismatchCheckout.Body.paymentId)&status=eq.pending&select=id").Count -eq 1 -and (Get-Rows "projects?lead_id=eq.$($mismatchLead.Id)&select=id").Count -eq 0) 'C13 divergência mantém pending e não cria projeto'

  Set-OrderStatus $pixPayment.gateway_order_id 'failed'
  $lateFailure = Invoke-Webhook "$($script:runId)-late-failure-main" 'charge.payment_failed' $pixPayment.gateway_order_id
  Assert-True ($lateFailure.Status -eq 200 -and $lateFailure.Body.reason -eq 'no_regression') 'C14 falha posterior é reconhecida fora de ordem'
  Assert-True ((Get-Rows "payments?id=eq.$($pix.Body.paymentId)&status=eq.approved&select=id").Count -eq 1) 'C14 aprovado não regride'

  foreach ($terminal in @('failed', 'canceled')) {
    Set-Scenario 'pending' $terminal
    $terminalLead = New-Lead 'roadmap' "pix-$terminal"
    $terminalCheckout = Checkout $terminalLead 'pix'
    $terminalPayment = (Get-Rows "payments?id=eq.$($terminalCheckout.Body.paymentId)&select=*")[0]
    $eventType = if ($terminal -eq 'failed') { 'charge.payment_failed' } else { 'charge.expired' }
    $terminalWebhook = Invoke-Webhook "$($script:runId)-$terminal-main" $eventType $terminalPayment.gateway_order_id
    Assert-True ($terminalWebhook.Status -eq 200 -and (Get-Rows "payments?id=eq.$($terminalCheckout.Body.paymentId)&status=eq.failed&select=id").Count -eq 1) "C15 Pix confirmado $terminal vira failed"
    Assert-True ((Get-Rows "projects?lead_id=eq.$($terminalLead.Id)&select=id").Count -eq 0) "C15 Pix $terminal não cria projeto"
  }

  Set-Scenario 'paid' 'paid'
  $cardLead = New-Lead 'roadmap' 'card-paid'
  $card = Checkout $cardLead 'cartao' 'tok_test_approved'
  Assert-True ($card.Status -eq 200 -and $card.Body.status -eq 'approved') 'C4 cartão tokenizado retorna aprovado'
  $cardPayment = (Get-Rows "payments?id=eq.$($card.Body.paymentId)&select=*")[0]
  Assert-True ($cardPayment.method -eq 'cartao' -and $cardPayment.status -eq 'pending') 'C4 cartão aguarda confirmação canônica do webhook'
  Assert-True ((Get-Rows "projects?lead_id=eq.$($cardLead.Id)&select=id").Count -eq 0) 'C4 resposta síncrona aprovada ainda não cria projeto'
  $cardAgain = Checkout $cardLead 'cartao' 'tok_test_should_not_be_sent'
  Assert-True ($cardAgain.Body.status -eq 'approved' -and $cardAgain.Body.paymentId -eq $card.Body.paymentId) 'C4 retry preserva checkoutStatus aprovado sem nova cobrança'
  $cardPaid = Invoke-Webhook "$($script:runId)-card-paid" 'order.paid' $cardPayment.gateway_order_id
  Assert-True ($cardPaid.Status -eq 200 -and $cardPaid.Body.status -eq 'approved') 'C10 webhook confirma cartão aprovado'
  Assert-True ((Get-Rows "payments?id=eq.$($card.Body.paymentId)&status=eq.approved&select=id").Count -eq 1) 'C10 cartão só avança para approved pelo webhook'
  Assert-True ((Get-Rows "projects?lead_id=eq.$($cardLead.Id)&select=id").Count -eq 1) 'C10 webhook do cartão cria projeto único'

  Set-Scenario 'failed' 'failed'
  $declinedLead = New-Lead 'roadmap' 'card-declined'
  $declined = Checkout $declinedLead 'cartao' 'tok_test_declined'
  Assert-True ($declined.Status -eq 200 -and $declined.Body.status -eq 'failed') 'C5 cartão recusado retorna failed para retry'
  Assert-True ((Get-Rows "projects?lead_id=eq.$($declinedLead.Id)&select=id").Count -eq 0) 'C5 cartão recusado não cria projeto'

  Set-Scenario 'pending' 'pending' 502
  $outageLead = New-Lead 'roadmap' 'gateway-outage'
  $outage = Checkout $outageLead 'pix'
  Assert-True ($outage.Status -eq 502 -and $outage.Body.error_code -eq 'PAGARME_ORDER_FAILED') 'C17 gateway indisponível retorna 502 tipado'
  Assert-True ((Get-Rows "payments?lead_id=eq.$($outageLead.Id)&status=eq.created&select=id").Count -eq 1) 'C17 falha externa deixa um payment created recuperável'

  $allGatewayRequests = (Invoke-Json 'GET' "$mockAdmin/__requests").Body | ConvertTo-Json -Depth 30 -Compress
  $allPaymentPayloads = Get-Rows 'payments?select=payload' | ConvertTo-Json -Depth 20 -Compress
  $functionLogs = ((Get-Content $serveOut -Raw -ErrorAction SilentlyContinue) + (Get-Content $serveErr -Raw -ErrorAction SilentlyContinue))
  foreach ($forbidden in @('4111111111111111', 'security_code', 'cvv', 'exp_month', 'exp_year')) {
    Assert-True (-not (($allGatewayRequests + $allPaymentPayloads + $functionLogs).ToLowerInvariant().Contains($forbidden))) "C9 não persiste/loga campo proibido $forbidden"
  }
  Assert-True ($allGatewayRequests.Contains('tok_test_approved') -and -not $allPaymentPayloads.Contains('tok_test_approved')) 'C9 token chega apenas ao gateway, não ao banco'

  $telemetrySid = 'r103-telemetry-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
  $telemetry = Invoke-Json 'POST' "$script:apiUrl/functions/v1/track-evento" @{
    sid = $telemetrySid
    eventos = @(
      @{ evento = 'cta_click'; etapa = 1; params = @{} },
      @{ evento = 'capitulo_visto'; etapa = 2; params = @{} },
      @{ evento = 'diag_abrir'; etapa = 3; params = @{} }
    )
  }
  Assert-True ($telemetry.Status -eq 200 -and $telemetry.Body.gravados -eq 3) 'C16 telemetria v7 aceita os três eventos'

  $legacyPayloads = @(
    @{
      consumer = 'lp-v5'; nome = 'Lead lp-v5'; email = 'lp-v5@example.test'; whatsapp = '(11) 91111-0001';
      contexto = 'Site institucional · QUER FALAR AGORA'; objetivos = 'Site e automação'; investimento = ''; prazo = 'o quanto antes';
      aiAnalysis = 'Contexto completo da árvore'; sid = "r103-lpv5-$($script:runId)"; site = 'https://cliente.example';
      descricao = 'Operação comercial'; folha = 'site'; nicho = 'serviços'; caminho = 'negócio → site'; modo = 'direto'; valor = 3;
      origem = 'google'; fbp = 'fb.1.test'; fbc = 'fb.1.click'; event_source_url = 'https://notechstack.com.br/'
    },
    @{
      consumer = 'agendar'; nome = 'Lead agendar'; email = 'agendar@example.test'; whatsapp = '(11) 91111-0002';
      contexto = 'Agendamento de diagnóstico'; objetivos = 'Marcar conversa'; investimento = ''; prazo = 'esta semana';
      aiAnalysis = 'Horário solicitado pelo lead'; sid = "r103-agendar-$($script:runId)"; site = $null;
      descricao = 'Agenda comercial'; folha = 'agenda'; nicho = 'serviços'; caminho = 'diagnóstico → agenda'; modo = 'ponte'; valor = 2;
      origem = 'direto'; fbp = $null; fbc = $null; event_source_url = 'https://notechstack.com.br/agendar/'
    },
    @{
      consumer = 'Roteador'; nome = 'Lead Roteador'; email = 'roteador@example.test'; whatsapp = '(11) 91111-0003';
      contexto = 'Roteador — landing page'; objetivos = 'Já tem telemedicina rodando, Quer atender também, além de encaminhar';
      investimento = ''; prazo = ''; aiAnalysis = 'Mensagem do formulário'
    },
    @{
      consumer = 'health'; nome = 'Lead Health'; email = 'health@example.test'; whatsapp = '(11) 91111-0004';
      contexto = 'nó Health — landing page'; objetivos = 'Estruturar atendimento (telemedicina)';
      investimento = ''; prazo = ''; aiAnalysis = 'Mensagem sobre a clínica'
    }
  )
  foreach ($payload in $legacyPayloads) {
    $consumer = [string]$payload.consumer
    $body = @{}
    foreach ($entry in $payload.GetEnumerator()) {
      if ($entry.Key -ne 'consumer') { $body[$entry.Key] = $entry.Value }
    }
    $result = Invoke-Json 'POST' "$script:apiUrl/functions/v1/send-lead-email" $body
    Assert-True ($result.Status -eq 200 -and $result.Body.saved -and $result.Body.leadId) "C16 consumidor $consumer grava seu payload real"
  }
  $legacyRows = Get-Rows 'leads?email=in.(lp-v5@example.test,agendar@example.test,roteador@example.test,health@example.test)&select=email,contexto,objetivos,sid,site,modo'
  Assert-True ($legacyRows.Count -eq 4) 'C16 quatro consumidores legados continuam gravando leads'
  Assert-True (($legacyRows | Where-Object email -eq 'lp-v5@example.test').sid -eq "r103-lpv5-$($script:runId)" -and ($legacyRows | Where-Object email -eq 'lp-v5@example.test').modo -eq 'direto') 'C16 lp-v5 preserva shape completo com sid e modo'
  Assert-True (($legacyRows | Where-Object email -eq 'agendar@example.test').contexto -eq 'Agendamento de diagnóstico' -and ($legacyRows | Where-Object email -eq 'agendar@example.test').site -eq $null) 'C16 agendar preserva seu contexto e campo opcional nulo'
  Assert-True (($legacyRows | Where-Object email -eq 'roteador@example.test').contexto -eq 'Roteador — landing page' -and ($legacyRows | Where-Object email -eq 'roteador@example.test').objetivos -like '*telemedicina*') 'C16 Roteador preserva marcas próprias'
  Assert-True (($legacyRows | Where-Object email -eq 'health@example.test').contexto -eq 'nó Health — landing page' -and ($legacyRows | Where-Object email -eq 'health@example.test').objetivos -eq 'Estruturar atendimento (telemedicina)') 'C16 health preserva contexto e objetivo próprios'

  [pscustomobject]@{
    result = 'PASS'
    assertions = $passes.Count
    checks = @('C3','C4','C5','C6','C7','C8','C9','C10','C11','C12','C13','C14','C15','C16','C17')
  } | ConvertTo-Json -Compress
} catch {
  if (Test-Path -LiteralPath $serveOut) { [Console]::Error.WriteLine(((Get-Content $serveOut | Select-Object -Last 80) -join [Environment]::NewLine)) }
  if (Test-Path -LiteralPath $serveErr) { [Console]::Error.WriteLine(((Get-Content $serveErr | Select-Object -Last 80) -join [Environment]::NewLine)) }
  if (Test-Path -LiteralPath $mockErr) { [Console]::Error.WriteLine(((Get-Content $mockErr | Select-Object -Last 40) -join [Environment]::NewLine)) }
  throw
} finally {
  foreach ($process in @($serveProcess, $mockProcess)) {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force
      $process.WaitForExit()
    }
  }
  Remove-Item -LiteralPath $tempEnv, $serveOut, $serveErr, $mockOut, $mockErr -Force -ErrorAction SilentlyContinue
}
