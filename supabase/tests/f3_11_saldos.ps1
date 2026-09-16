[CmdletBinding()]
param(
  [ValidateSet('C5', 'C6', 'C7', 'C8', 'C9', 'D', 'All')]
  [string]$Scenario = 'All'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$supabase = (Get-Command supabase -ErrorAction Stop).Source
$node = (Get-Command node -ErrorAction Stop).Source
$mockPort = 54328
$mockAdmin = "http://127.0.0.1:$mockPort"
$tempEnv = [IO.Path]::GetTempFileName()
$serveOut = [IO.Path]::GetTempFileName()
$serveErr = [IO.Path]::GetTempFileName()
$mockOut = [IO.Path]::GetTempFileName()
$mockErr = [IO.Path]::GetTempFileName()
$serveProcess = $null
$mockProcess = $null
$script:passes = [System.Collections.Generic.List[string]]::new()
$script:leadIds = [System.Collections.Generic.List[string]]::new()
$script:clientEmails = [System.Collections.Generic.List[string]]::new()
$script:userIds = [System.Collections.Generic.List[string]]::new()
$script:runId = [guid]::NewGuid().ToString('N').Substring(0, 12)

function Get-StatusValue([string[]]$Lines, [string]$Name) {
  $match = $Lines | Select-String -Pattern ('^' + [regex]::Escape($Name) + '="([^"]+)"$') | Select-Object -First 1
  if (-not $match) { throw "Supabase local status did not return $Name" }
  $match.Matches[0].Groups[1].Value
}

function Invoke-Json([string]$Method, [string]$Uri, $Body = $null, [hashtable]$Headers = @{}) {
  $params = @{ UseBasicParsing = $true; SkipHttpErrorCheck = $true; Method = $Method; Uri = $Uri; Headers = $Headers }
  if ($null -ne $Body) { $params.ContentType = 'application/json'; $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress) }
  $response = Invoke-WebRequest @params
  $parsed = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
  [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $parsed }
}

function Assert-True([bool]$Condition, [string]$Label) {
  if (-not $Condition) { throw "ASSERTION FAILED: $Label" }
  $script:passes.Add($Label)
}

function Rest([string]$Method, [string]$Path, $Body = $null, [hashtable]$ExtraHeaders = @{}) {
  Invoke-Json $Method "$script:apiUrl/rest/v1/$Path" $Body (@{} + $script:restHeaders + $ExtraHeaders)
}

function Rows([string]$Path) {
  $result = Rest 'GET' $Path
  if ($result.Status -ge 300) { throw "REST GET failed ($($result.Status)): $Path" }
  if (-not $result.Body) { return @() }
  @($result.Body)
}

function New-AuthUser([string]$Email, [string]$Role, [string]$Password) {
  $result = Invoke-Json 'POST' "$script:apiUrl/auth/v1/admin/users" @{ email = $Email; password = $Password; email_confirm = $true; app_metadata = @{ role = $Role } } $script:restHeaders
  if ($result.Status -ge 300 -or -not $result.Body.id) { throw "Could not create $Role fixture user ($($result.Status))" }
  $script:userIds.Add([string]$result.Body.id)
  $result.Body
}

function SignIn([string]$Email, [string]$Password) {
  $result = Invoke-Json 'POST' "$script:apiUrl/auth/v1/token?grant_type=password" @{ email = $Email; password = $Password } @{ apikey = $script:anonKey }
  if ($result.Status -ge 300 -or -not $result.Body.access_token) { throw "Could not sign in fixture user ($($result.Status))" }
  [string]$result.Body.access_token
}

function New-Lead([string]$Suffix) {
  $id = [guid]::NewGuid().ToString()
  $sid = "f311-$Suffix-$($script:runId)"
  $email = "f311-$Suffix-$($script:runId)@example.test"
  $result = Rest 'POST' 'leads' @{ id = $id; nome = "Lead F311 $Suffix"; email = $email; whatsapp = '(11) 99999-0000'; contexto = 'roadmap'; sid = $sid } @{ Prefer = 'return=minimal' }
  if ($result.Status -ge 300) { throw "Could not create lead fixture ($($result.Status))" }
  $script:leadIds.Add($id)
  $script:clientEmails.Add($email)
  [pscustomobject]@{ Id = $id; Sid = $sid; Email = $email }
}

function Checkout($Lead) {
  Invoke-Json 'POST' "$script:apiUrl/functions/v1/roadmap-checkout" @{
    leadId = $Lead.Id; sid = $Lead.Sid; metodo = 'pix'; amount_cents = 1
    answers = @{ objetivo = 'Lancar produto'; negocio = 'SaaS'; publico = 'PMEs'; ferramentas = 'Planilhas'; resultado = 'MVP publicado' }
  } @{ apikey = $script:anonKey }
}

function Set-Scenario([string]$Create, [string]$Confirm) {
  $result = Invoke-Json 'POST' "$mockAdmin/__scenario" @{ createStatus = $Create; confirmStatus = $Confirm; httpStatus = 200 }
  if ($result.Status -ne 200) { throw 'Could not configure gateway mock' }
}

function Set-OrderStatus([string]$OrderId, [string]$Status) {
  $result = Invoke-Json 'POST' "$mockAdmin/__order-status" @{ id = $OrderId; status = $Status }
  if ($result.Status -ne 200) { throw "Could not update mock order $OrderId" }
}

function Invoke-Webhook([string]$EventId, [string]$Type, [string]$OrderId, [string]$ClaimedStatus, [string]$Auth = $script:validBasic) {
  $headers = if ($Auth) { @{ Authorization = $Auth } } else { @{} }
  $data = if ($Type.StartsWith('charge.')) {
    @{ id = "charge-$EventId"; status = $ClaimedStatus; order = @{ id = $OrderId } }
  } else {
    @{ id = $OrderId; status = $ClaimedStatus }
  }
  Invoke-Json 'POST' "$script:apiUrl/functions/v1/pagarme-webhook-no" @{ id = $EventId; type = $Type; data = $data } $headers
}

function PaymentForLead([string]$LeadId) {
  $rows = Rows "payments?lead_id=eq.$LeadId&select=*"
  if ($rows.Count -ne 1) { throw "Expected one payment for lead $LeadId" }
  $rows[0]
}

function AdminSaldos([string]$Token) {
  $result = Invoke-Json 'POST' "$script:apiUrl/rest/v1/rpc/list_admin_saldos" @{} @{ apikey = $script:anonKey; Authorization = "Bearer $Token" }
  if ($result.Status -ne 200) { throw "Could not read admin saldos ($($result.Status))" }
  $result.Body
}

try {
  $statusLines = & $supabase status -o env 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Supabase local stack is not available' }
  $script:apiUrl = Get-StatusValue $statusLines 'API_URL'
  $script:anonKey = Get-StatusValue $statusLines 'ANON_KEY'
  $serviceRoleKey = Get-StatusValue $statusLines 'SERVICE_ROLE_KEY'
  $script:restHeaders = @{ apikey = $serviceRoleKey; Authorization = "Bearer $serviceRoleKey" }
  $script:validBasic = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('f311-user:f311-pass'))

  [IO.File]::WriteAllText($tempEnv, @"
PAGARME_SECRET_KEY=sk_test_f311_local
PAGARME_WEBHOOK_USER=f311-user
PAGARME_WEBHOOK_PASS=f311-pass
PAGARME_API_URL=http://host.docker.internal:$mockPort
"@)
  $mockProcess = Start-Process -FilePath $node -ArgumentList @('supabase/tests/r1_03_pagarme_mock.mjs', "$mockPort") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $mockOut -RedirectStandardError $mockErr -PassThru
  $serveProcess = Start-Process -FilePath $supabase -ArgumentList @('functions', 'serve', '--no-verify-jwt', '--env-file', $tempEnv) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $serveOut -RedirectStandardError $serveErr -PassThru

  $deadline = [DateTime]::UtcNow.AddSeconds(75); $warm = $null
  do {
    if ($mockProcess.HasExited) { throw "Mock exited early with code $($mockProcess.ExitCode)" }
    if ($serveProcess.HasExited) { throw "Functions server exited early with code $($serveProcess.ExitCode)" }
    try {
      $warm = Invoke-Json 'POST' "$script:apiUrl/functions/v1/pagarme-webhook-no" @{ id = "f311-warm-$($script:runId)"; type = 'order.paid'; data = @{ id = 'missing-order'; status = 'paid' } }
      if ($warm.Status -eq 401) { break }
    } catch { }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)
  Assert-True ($null -ne $warm -and $warm.Status -eq 401) 'C13 Edge Functions e mock local ficam prontos'

  $nonce = [guid]::NewGuid().ToString('N')
  $password = "F311-$nonce!aA1"
  $adminEmail = "f311-admin-$nonce@example.test"
  $clientEmail = "f311-client-$nonce@example.test"
  New-AuthUser $adminEmail 'NO_ADMIN' $password | Out-Null
  New-AuthUser $clientEmail 'CLIENT' $password | Out-Null
  $adminToken = SignIn $adminEmail $password
  $clientToken = SignIn $clientEmail $password

  $eventCountBefore = (Rows 'payment_events?select=id').Count
  $badAuth = Invoke-Webhook "f311-bad-auth-$nonce" 'order.paid' 'missing-order' 'paid' 'Basic d3Jvbmc6d3Jvbmc='
  Assert-True ($badAuth.Status -eq 401 -and (Rows 'payment_events?select=id').Count -eq $eventCountBefore) 'C13 Basic inválido retorna 401 sem gravar evento'

  Set-Scenario 'pending' 'paid'
  $refundLead = New-Lead 'refund'
  $refundCheckout = Checkout $refundLead
  Assert-True ($refundCheckout.Status -eq 200 -and $refundCheckout.Body.status -eq 'pending') 'C6 checkout de reembolso começa pending'
  $refundPayment = PaymentForLead $refundLead.Id
  $paid = Invoke-Webhook "f311-refund-paid-$nonce" 'order.paid' $refundPayment.gateway_order_id 'paid'
  Assert-True ($paid.Status -eq 200 -and $paid.Body.status -eq 'approved' -and $paid.Body.project_id) 'C6 webhook aprovado provisiona projeto'
  $refundProjectId = [string]$paid.Body.project_id
  Set-OrderStatus $refundPayment.gateway_order_id 'refunded'
  $refundEventId = "f311-refund-$nonce"
  $refund = Invoke-Webhook $refundEventId 'charge.refunded' $refundPayment.gateway_order_id 'refunded'
  Assert-True ($refund.Status -eq 200 -and $refund.Body.applied -and $refund.Body.status -eq 'refunded') 'C6 reconsulta aplica refunded'
  Assert-True ((Rows "payments?id=eq.$($refundPayment.id)&status=eq.refunded&project_id=eq.$refundProjectId&select=id").Count -eq 1) 'C6 pagamento refunded mantém correlação do projeto'
  Assert-True ((Rows "payment_events?gateway_event_id=eq.$refundEventId&select=id").Count -eq 1 -and (Rows "activity_events?project_id=eq.$refundProjectId&type=eq.payment.refunded&select=id").Count -eq 1) 'C6 reembolso cria um evento e uma atividade'
  $refundSaldos = AdminSaldos $adminToken
  $refundMovement = @($refundSaldos.realized | Where-Object { $_.id -eq "payment:$($refundPayment.id)" })
  Assert-True ($refundMovement.Count -eq 1 -and $refundMovement[0].type -eq 'reembolso' -and $refundMovement[0].amount_cents -eq -14990) 'C6 Saldos expõe reembolso negativo de 14990'

  $refundVectorBefore = @((Rows "payment_events?payment_id=eq.$($refundPayment.id)&select=id").Count, (Rows "activity_events?project_id=eq.$refundProjectId&select=id").Count, $refundSaldos.realizedCents) -join ','
  $refundReplay = Invoke-Webhook $refundEventId 'charge.refunded' $refundPayment.gateway_order_id 'refunded'
  $refundVectorAfter = @((Rows "payment_events?payment_id=eq.$($refundPayment.id)&select=id").Count, (Rows "activity_events?project_id=eq.$refundProjectId&select=id").Count, (AdminSaldos $adminToken).realizedCents) -join ','
  Assert-True ($refundReplay.Status -eq 200 -and $refundReplay.Body.idempotent -and $refundVectorBefore -eq $refundVectorAfter) 'C8 replay de reembolso não altera contagens nem saldo'

  Set-Scenario 'pending' 'paid'
  $chargebackLead = New-Lead 'chargeback'
  $chargebackCheckout = Checkout $chargebackLead
  $chargebackPayment = PaymentForLead $chargebackLead.Id
  $chargebackPaid = Invoke-Webhook "f311-chargeback-paid-$nonce" 'order.paid' $chargebackPayment.gateway_order_id 'paid'
  $chargebackProjectId = [string]$chargebackPaid.Body.project_id
  Set-OrderStatus $chargebackPayment.gateway_order_id 'chargedback'
  $chargebackEventId = "f311-chargeback-$nonce"
  $chargeback = Invoke-Webhook $chargebackEventId 'charge.chargedback' $chargebackPayment.gateway_order_id 'chargedback'
  Assert-True ($chargebackCheckout.Status -eq 200 -and $chargeback.Status -eq 200 -and $chargeback.Body.status -eq 'chargedback') 'C7 reconsulta aplica chargedback'
  Assert-True ((Rows "payments?id=eq.$($chargebackPayment.id)&status=eq.chargedback&select=id").Count -eq 1 -and (Rows "activity_events?project_id=eq.$chargebackProjectId&type=eq.payment.chargedback&select=id").Count -eq 1) 'C7 chargeback propaga uma vez para pagamento e atividade'
  $chargebackMovement = @((AdminSaldos $adminToken).realized | Where-Object { $_.id -eq "payment:$($chargebackPayment.id)" })
  Assert-True ($chargebackMovement.Count -eq 1 -and $chargebackMovement[0].type -eq 'estorno' -and $chargebackMovement[0].amount_cents -eq -14990) 'C7 Saldos expõe estorno negativo de 14990'

  Set-Scenario 'pending' 'pending'
  $earlyLead = New-Lead 'out-of-order'
  $earlyCheckout = Checkout $earlyLead
  $earlyPayment = PaymentForLead $earlyLead.Id
  Set-OrderStatus $earlyPayment.gateway_order_id 'refunded'
  $earlyRefundId = "f311-early-refund-$nonce"
  $earlyRefund = Invoke-Webhook $earlyRefundId 'charge.refunded' $earlyPayment.gateway_order_id 'refunded'
  Assert-True ($earlyCheckout.Status -eq 200 -and $earlyRefund.Status -eq 200 -and $earlyRefund.Body.reason -eq 'awaiting_approval') 'C9 reembolso antecipado aguarda aprovação'
  Assert-True ((Rows "payments?id=eq.$($earlyPayment.id)&status=eq.pending&select=id").Count -eq 1 -and (Rows "projects?lead_id=eq.$($earlyLead.Id)&select=id").Count -eq 0 -and (Rows "payment_events?gateway_event_id=eq.$earlyRefundId&select=id").Count -eq 1) 'C9 evento antecipado preserva histórico sem projeto'
  $lateApproval = Invoke-Webhook "f311-late-approval-$nonce" 'order.paid' $earlyPayment.gateway_order_id 'paid'
  Assert-True ($lateApproval.Status -eq 200 -and $lateApproval.Body.status -eq 'refunded' -and $lateApproval.Body.project_id) 'C9 aprovação posterior aplica estado final refunded'
  $earlyProjectId = [string]$lateApproval.Body.project_id
  Assert-True ((Rows "projects?lead_id=eq.$($earlyLead.Id)&select=id").Count -eq 1 -and (Rows "activity_events?project_id=eq.$earlyProjectId&select=id").Count -eq 2) 'C9 aprovação fora de ordem cria um projeto e duas atividades financeiras'

  $clientHeaders = @{ apikey = $script:anonKey; Authorization = "Bearer $clientToken" }
  $clientRpc = Invoke-Json 'POST' "$script:apiUrl/rest/v1/rpc/list_admin_saldos" @{} $clientHeaders
  $clientPayments = Invoke-Json 'GET' "$script:apiUrl/rest/v1/payments?select=id" $null $clientHeaders
  $clientEvents = Invoke-Json 'GET' "$script:apiUrl/rest/v1/payment_events?select=id" $null $clientHeaders
  $clientInstallments = Invoke-Json 'GET' "$script:apiUrl/rest/v1/installments?select=id" $null $clientHeaders
  Assert-True ($clientRpc.Status -ge 400) 'C5 CLIENT não executa list_admin_saldos'
  $paymentsHidden = $clientPayments.Status -ge 400 -or ($clientPayments.Status -eq 200 -and @($clientPayments.Body).Count -eq 0)
  $eventsHidden = $clientEvents.Status -ge 400 -or ($clientEvents.Status -eq 200 -and @($clientEvents.Body).Count -eq 0)
  $installmentsHidden = $clientInstallments.Status -ge 400 -or ($clientInstallments.Status -eq 200 -and @($clientInstallments.Body).Count -eq 0)
  Assert-True ($paymentsHidden -and $eventsHidden -and $installmentsHidden) 'C5 CLIENT não lê pagamentos eventos ou parcelas'

  [pscustomobject]@{ result = 'PASS'; scenario = $Scenario; assertions = $script:passes.Count } | ConvertTo-Json -Compress
} catch {
  if (Test-Path -LiteralPath $serveOut) { [Console]::Error.WriteLine(((Get-Content $serveOut | Select-Object -Last 80) -join [Environment]::NewLine)) }
  if (Test-Path -LiteralPath $serveErr) { [Console]::Error.WriteLine(((Get-Content $serveErr | Select-Object -Last 80) -join [Environment]::NewLine)) }
  throw
} finally {
  if ($script:apiUrl -and $script:restHeaders) {
    foreach ($leadId in $script:leadIds) {
      $payments = Rows "payments?lead_id=eq.$leadId&select=id,project_id"
      foreach ($payment in $payments) { Rest 'DELETE' "payment_events?payment_id=eq.$($payment.id)" | Out-Null }
      foreach ($projectId in @($payments | ForEach-Object { $_.project_id } | Where-Object { $_ } | Select-Object -Unique)) {
        Rest 'DELETE' "activity_events?project_id=eq.$projectId" | Out-Null
        Rest 'DELETE' "kanban_items?project_id=eq.$projectId" | Out-Null
        Rest 'DELETE' "roadmaps?project_id=eq.$projectId" | Out-Null
        Rest 'DELETE' "projects?id=eq.$projectId" | Out-Null
      }
      foreach ($payment in $payments) { Rest 'DELETE' "payments?id=eq.$($payment.id)" | Out-Null }
      Rest 'DELETE' "leads?id=eq.$leadId" | Out-Null
    }
    foreach ($email in $script:clientEmails) { Rest 'DELETE' "clients?email=eq.$email" | Out-Null }
    foreach ($userId in $script:userIds) { Invoke-Json 'DELETE' "$script:apiUrl/auth/v1/admin/users/$userId" $null $script:restHeaders | Out-Null }
  }
  if ($serveProcess -and -not $serveProcess.HasExited) { Stop-Process -Id $serveProcess.Id -Force; $serveProcess.WaitForExit() }
  if ($mockProcess -and -not $mockProcess.HasExited) { Stop-Process -Id $mockProcess.Id -Force; $mockProcess.WaitForExit() }
  Remove-Item -LiteralPath $tempEnv, $serveOut, $serveErr, $mockOut, $mockErr -Force -ErrorAction SilentlyContinue
}
