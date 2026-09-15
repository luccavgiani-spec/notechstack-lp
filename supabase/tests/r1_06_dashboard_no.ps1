[CmdletBinding()]
param(
  [ValidateSet('C9', 'C10', 'C11', 'C12', 'C14', 'C19', 'C20', 'All')]
  [string]$Scenario = 'All'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$supabase = (Get-Command supabase -ErrorAction Stop).Source
$tempEnv = [IO.Path]::GetTempFileName()
$serveOut = [IO.Path]::GetTempFileName()
$serveErr = [IO.Path]::GetTempFileName()
$serveProcess = $null
$script:fixtures = @()
$script:users = @()
$script:passes = [System.Collections.Generic.List[string]]::new()

function Get-StatusValue([string[]]$Lines, [string]$Name) {
  $match = $Lines | Select-String -Pattern ('^' + [regex]::Escape($Name) + '="([^"]+)"$') | Select-Object -First 1
  if (-not $match) { throw "Supabase local status did not return $Name" }
  return $match.Matches[0].Groups[1].Value
}

function Invoke-Json([string]$Method, [string]$Uri, $Body = $null, [hashtable]$Headers = @{}) {
  $params = @{ UseBasicParsing = $true; SkipHttpErrorCheck = $true; Method = $Method; Uri = $Uri; Headers = $Headers }
  if ($null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
  }
  $response = Invoke-WebRequest @params
  $parsed = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
  [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $parsed }
}

function Assert-True([bool]$Condition, [string]$Label) {
  if (-not $Condition) { throw "ASSERTION FAILED: $Label" }
  $script:passes.Add($Label)
}

function Rest([string]$Method, [string]$Path, $Body = $null, [hashtable]$ExtraHeaders = @{}) {
  $headers = @{} + $script:restHeaders + $ExtraHeaders
  Invoke-Json $Method "$script:apiUrl/rest/v1/$Path" $Body $headers
}

function Rows([string]$Path) {
  $response = Rest 'GET' $Path
  if ($response.Status -ge 300) { throw "REST GET failed ($($response.Status)): $Path" }
  if (-not $response.Body) { return @() }
  @($response.Body)
}

function New-AuthUser([string]$Email, [string]$Role, [string]$Password) {
  $response = Invoke-Json 'POST' "$script:apiUrl/auth/v1/admin/users" @{
    email = $Email; password = $Password; email_confirm = $true; app_metadata = @{ role = $Role }
  } $script:restHeaders
  if ($response.Status -ge 300 -or -not $response.Body.id) { throw "Could not create $Role test user: $($response.Status)" }
  $script:users += [pscustomobject]@{ Id = [string]$response.Body.id; Password = $Password }
  $response.Body
}

function New-Project([string]$Id, [string]$Name, [string]$LeadStatus, [AllowNull()][object]$ProjectStatus, [string]$AccessStatus, [datetime]$ReleasedAt, [AllowNull()][object]$Tier = $null) {
  $projectBody = @{
    id = $Id; client_id = $script:clientId; name = $Name; niche = 'r106'; lead_status = $LeadStatus;
    access_status = $AccessStatus; access_released_at = $ReleasedAt.ToUniversalTime().ToString('o');
    modules = @{ como_funciona = 'ativo'; prototipo = 'ativo'; etapas = 'ativo'; editor = 'bloqueado'; versoes = 'bloqueado'; marca = 'bloqueado' }
  }
  if ($null -ne $ProjectStatus) { $projectBody.project_status = [string]$ProjectStatus }
  if ($null -ne $Tier) { $projectBody.tier = [string]$Tier }
  $response = Rest 'POST' 'projects' $projectBody @{ Prefer = 'return=minimal' }
  if ($response.Status -ge 300) { throw "Could not create fixture project $Id ($($response.Status)): $($response.Body | ConvertTo-Json -Compress -Depth 5)" }
  $script:fixtures += $Id
}

function Invoke-Function([string]$Name, $Body, [string]$Token) {
  Invoke-Json 'POST' "$script:apiUrl/functions/v1/$Name" $Body @{ Authorization = "Bearer $Token"; apikey = $script:anonKey }
}

function SignIn([string]$Email, [string]$Password) {
  $response = Invoke-Json 'POST' "$script:apiUrl/auth/v1/token?grant_type=password" @{ email = $Email; password = $Password } @{ apikey = $script:anonKey }
  if ($response.Status -ge 300 -or -not $response.Body.access_token) { throw "Could not sign in fixture user ($($response.Status))" }
  [string]$response.Body.access_token
}

try {
  $statusLines = & $supabase status -o env 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Supabase local stack is not available' }
  $script:apiUrl = Get-StatusValue $statusLines 'API_URL'
  $script:anonKey = Get-StatusValue $statusLines 'ANON_KEY'
  $serviceRoleKey = Get-StatusValue $statusLines 'SERVICE_ROLE_KEY'
  $script:restHeaders = @{ apikey = $serviceRoleKey; Authorization = "Bearer $serviceRoleKey" }

  # The functions server receives only ephemeral process configuration. No
  # repository environment file is read or written.
  [IO.File]::WriteAllText($tempEnv, "SUPABASE_URL=$script:apiUrl`nSUPABASE_ANON_KEY=$script:anonKey`nSUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey`n")
  $serveProcess = Start-Process -FilePath $supabase -ArgumentList @('functions', 'serve', '--no-verify-jwt', '--env-file', $tempEnv) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $serveOut -RedirectStandardError $serveErr -PassThru

  $deadline = [DateTime]::UtcNow.AddSeconds(75)
  $warm = $null
  do {
    if ($serveProcess.HasExited) { throw "Functions server exited early with code $($serveProcess.ExitCode)" }
    try {
      $warm = Invoke-Json 'POST' "$script:apiUrl/functions/v1/project-convert" @{} @{ apikey = $script:anonKey }
      if ($warm.Status -eq 401) { break }
    } catch { }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)
  Assert-True ($null -ne $warm -and $warm.Status -eq 401) 'R1-06 functions server is ready'

  $nonce = [guid]::NewGuid().ToString('N')
  $adminEmail = "r106-admin-$nonce@example.test"
  $clientEmail = "r106-client-$nonce@example.test"
  $password = "R106-$nonce!aA1"
  $admin = New-AuthUser $adminEmail 'NO_ADMIN' $password
  $client = New-AuthUser $clientEmail 'CLIENT' $password
  $script:clientId = [guid]::NewGuid().ToString()
  Rest 'POST' 'clients' @{ id = $script:clientId; name = 'Cliente R106 HTTP'; slug = "r106-$nonce"; email = $clientEmail } @{ Prefer = 'return=minimal' } | Out-Null
  Rest 'POST' 'memberships' @{ client_id = $script:clientId; user_id = $client.id; role = 'CLIENT' } @{ Prefer = 'return=minimal' } | Out-Null

  $now = [DateTime]::UtcNow
  $c9 = [guid]::NewGuid().ToString(); $c10 = [guid]::NewGuid().ToString(); $c11 = [guid]::NewGuid().ToString(); $c12 = [guid]::NewGuid().ToString()
  New-Project $c9 'R106 janela válida' 'JANELA_DE_DECISAO' $null 'INICIAL_15_DIAS' $now
  New-Project $c10 'R106 acesso expirado' 'JANELA_DE_DECISAO' $null 'INICIAL_15_DIAS' $now.AddDays(-16)
  New-Project $c11 'R106 validação' 'JANELA_DE_DECISAO' $null 'INICIAL_15_DIAS' $now
  New-Project $c12 'R106 já convertido' 'CONVERTIDO' 'CONVERTIDO' 'ATIVO_ATE_FIM_DO_PROJETO' $now 'basico'
  Rest 'DELETE' "activity_events?project_id=in.($($script:fixtures -join ','))" | Out-Null
  $adminToken = SignIn $adminEmail $password
  $clientToken = SignIn $clientEmail $password

  $valid = @{ projectId = $c9; tier = 'basico'; amountCents = 125000; paymentMethod = 'pix'; installments = 1; deadlineDays = 15; requestId = "r106-convert-$nonce" }
  if ($Scenario -in @('C9', 'All')) {
    $response = Invoke-Function 'project-convert' $valid $adminToken
    Assert-True ($response.Status -eq 200 -and $response.Body.leadStatus -eq 'CONVERTIDO' -and $response.Body.projectStatus -eq 'CONVERTIDO' -and $response.Body.accessStatus -eq 'ATIVO_ATE_FIM_DO_PROJETO') 'C9 valid conversion returns the aggregate result'
    Assert-True ((Rows "commercial_terms?project_id=eq.$c9&select=project_id,tier,amount_cents,payment_method,installments,deadline_days").Count -eq 1) 'C9 commercial terms persist'
    Assert-True ((Rows "activity_events?project_id=eq.$c9&request_id=eq.$($valid.requestId)&select=id").Count -eq 1) 'C9 conversion emits one event'
  }

  if ($Scenario -in @('C10', 'C19', 'All')) {
    $expiredRequest = "r106-expired-$nonce"
    $expiredBody = @{ projectId = $c10; tier = 'essencial'; amountCents = 99000; paymentMethod = 'pix'; installments = 1; deadlineDays = 10; requestId = $expiredRequest }
    $response = Invoke-Function 'project-convert' $expiredBody $adminToken
    Assert-True ($response.Status -eq 200 -and $response.Body.accessStatus -eq 'ATIVO_ATE_FIM_DO_PROJETO') 'C10 expired project conversion restores access'
    if ($Scenario -in @('C19', 'All')) {
      $replay = Invoke-Function 'project-convert' $expiredBody $adminToken
      Assert-True ($replay.Status -eq 200 -and (Rows "activity_events?project_id=eq.$c10&request_id=eq.$expiredRequest&select=id").Count -eq 1) 'C19 conversion retry keeps one event and one effect'
    }
  }

  if ($Scenario -in @('C11', 'All')) {
    foreach ($field in @('tier', 'amountCents', 'paymentMethod', 'installments', 'deadlineDays')) {
      $body = @{} + $valid; $body.projectId = $c11; $body.requestId = "r106-missing-$field-$nonce"; $body.Remove($field)
      $response = Invoke-Function 'project-convert' $body $adminToken
      Assert-True ($response.Status -eq 422 -and @($response.Body.missingFields) -contains $field) "C11 missing $field returns 422"
    }
    Assert-True ((Rows "projects?id=eq.$c11&lead_status=eq.JANELA_DE_DECISAO&select=id").Count -eq 1 -and (Rows "commercial_terms?project_id=eq.$c11&select=project_id").Count -eq 0) 'C11 invalid conversions leave state unchanged'
  }

  if ($Scenario -in @('C12', 'All')) {
    $response = Invoke-Function 'project-convert' (@{ projectId = $c12; tier = 'basico'; amountCents = 125000; paymentMethod = 'pix'; installments = 1; deadlineDays = 15; requestId = "r106-already-$nonce" }) $adminToken
    Assert-True ($response.Status -eq 409 -and (Rows "activity_events?project_id=eq.$c12&select=id").Count -eq 0) 'C12 repeated conversion returns 409 without activity'
  }

  if ($Scenario -in @('C14', 'All')) {
    $statusBody = @{ projectId = $c9; target = 'AGENDADO'; requestId = "r106-status-$nonce" }
    $response = Invoke-Function 'project-status-transition' $statusBody $adminToken
    Assert-True ($response.Status -eq 200 -and $response.Body.projectStatus -eq 'AGENDADO') 'C14 CONVERTIDO to AGENDADO returns 200'
    $invalid = Invoke-Function 'project-status-transition' (@{ projectId = $c9; target = 'V1_PUBLICADA'; requestId = "r106-status-invalid-$nonce" }) $adminToken
    Assert-True ($invalid.Status -eq 409) 'C14 invalid project transition returns 409'
  }

  if ($Scenario -in @('C20', 'All')) {
    $forbiddenConvert = Invoke-Function 'project-convert' (@{ projectId = $c11; tier = 'basico'; amountCents = 125000; paymentMethod = 'pix'; installments = 1; deadlineDays = 15; requestId = "r106-client-convert-$nonce" }) $clientToken
    $forbiddenStatus = Invoke-Function 'project-status-transition' (@{ projectId = $c12; target = 'AGENDADO'; requestId = "r106-client-status-$nonce" }) $clientToken
    Assert-True ($forbiddenConvert.Status -eq 403) 'C20 CLIENT conversion returns 403'
    Assert-True ($forbiddenStatus.Status -eq 403) 'C20 CLIENT status transition returns 403'
  }

  [pscustomobject]@{ result = 'PASS'; assertions = $script:passes.Count; scenario = $Scenario } | ConvertTo-Json -Compress
} finally {
  foreach ($projectId in $script:fixtures) {
    Rest 'DELETE' "activity_events?project_id=eq.$projectId" | Out-Null
    Rest 'DELETE' "commercial_terms?project_id=eq.$projectId" | Out-Null
    Rest 'DELETE' "kanban_items?project_id=eq.$projectId" | Out-Null
    Rest 'DELETE' "projects?id=eq.$projectId" | Out-Null
  }
  if ($script:clientId) { Rest 'DELETE' "memberships?client_id=eq.$($script:clientId)" | Out-Null; Rest 'DELETE' "clients?id=eq.$($script:clientId)" | Out-Null }
  foreach ($user in $script:users) { Invoke-Json 'DELETE' "$script:apiUrl/auth/v1/admin/users/$($user.Id)" $null $script:restHeaders | Out-Null }
  if ($serveProcess -and -not $serveProcess.HasExited) { Stop-Process -Id $serveProcess.Id -Force; $serveProcess.WaitForExit() }
  Remove-Item -LiteralPath $tempEnv, $serveOut, $serveErr -Force -ErrorAction SilentlyContinue
}
