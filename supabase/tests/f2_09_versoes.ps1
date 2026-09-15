[CmdletBinding()]
param(
  [ValidateSet('C2', 'C3', 'C5', 'C6', 'C7', 'C10', 'C13', 'C14', 'All')]
  [string]$Scenario = 'All'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$supabase = (Get-Command supabase -ErrorAction Stop).Source
$tempEnv = [IO.Path]::GetTempFileName()
$serveOut = [IO.Path]::GetTempFileName()
$serveErr = [IO.Path]::GetTempFileName()
$serveProcess = $null
$script:users = @()
$script:fixtures = @()
$script:passes = [System.Collections.Generic.List[string]]::new()

function Get-StatusValue([string[]]$Lines, [string]$Name) {
  $match = $Lines | Select-String -Pattern ('^' + [regex]::Escape($Name) + '="([^"]+)"$') | Select-Object -First 1
  if (-not $match) { throw "Supabase local status did not return $Name" }
  return $match.Matches[0].Groups[1].Value
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
  $script:users += [pscustomobject]@{ Id = [string]$result.Body.id }
  $result.Body
}

function SignIn([string]$Email, [string]$Password) {
  $result = Invoke-Json 'POST' "$script:apiUrl/auth/v1/token?grant_type=password" @{ email = $Email; password = $Password } @{ apikey = $script:anonKey }
  if ($result.Status -ge 300 -or -not $result.Body.access_token) { throw "Could not sign in fixture user ($($result.Status))" }
  [string]$result.Body.access_token
}

function Invoke-Function([string]$Name, $Body, [string]$Token) {
  Invoke-Json 'POST' "$script:apiUrl/functions/v1/$Name" $Body @{ Authorization = "Bearer $Token"; apikey = $script:anonKey }
}

try {
  $statusLines = & $supabase status -o env 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Supabase local stack is not available' }
  $script:apiUrl = Get-StatusValue $statusLines 'API_URL'
  $script:anonKey = Get-StatusValue $statusLines 'ANON_KEY'
  $serviceRoleKey = Get-StatusValue $statusLines 'SERVICE_ROLE_KEY'
  $script:restHeaders = @{ apikey = $serviceRoleKey; Authorization = "Bearer $serviceRoleKey" }
  [IO.File]::WriteAllText($tempEnv, "SUPABASE_URL=$script:apiUrl`nSUPABASE_ANON_KEY=$script:anonKey`nSUPABASE_SERVICE_ROLE_KEY=$serviceRoleKey`n")
  $serveProcess = Start-Process -FilePath $supabase -ArgumentList @('functions', 'serve', '--no-verify-jwt', '--env-file', $tempEnv) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $serveOut -RedirectStandardError $serveErr -PassThru

  $deadline = [DateTime]::UtcNow.AddSeconds(75); $warm = $null
  do {
    if ($serveProcess.HasExited) { throw "Functions server exited early with code $($serveProcess.ExitCode)" }
    try { $warm = Invoke-Json 'POST' "$script:apiUrl/functions/v1/project-publish-version" @{} @{ apikey = $script:anonKey }; if ($warm.Status -eq 401) { break } } catch { }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)
  Assert-True ($null -ne $warm -and $warm.Status -eq 401) 'F2-09 publish function is ready'

  $nonce = [guid]::NewGuid().ToString('N')
  $password = "F209-$nonce!aA1"
  $adminEmail = "f209-admin-$nonce@example.test"; $clientEmail = "f209-client-$nonce@example.test"
  $admin = New-AuthUser $adminEmail 'NO_ADMIN' $password
  $client = New-AuthUser $clientEmail 'CLIENT' $password
  $clientId = [guid]::NewGuid().ToString(); Rest 'POST' 'clients' @{ id = $clientId; name = 'Cliente F209 HTTP'; slug = "f209-$nonce"; email = $clientEmail } @{ Prefer = 'return=minimal' } | Out-Null
  Rest 'POST' 'memberships' @{ client_id = $clientId; user_id = $client.id; role = 'CLIENT' } @{ Prefer = 'return=minimal' } | Out-Null
  $projectId = [guid]::NewGuid().ToString()
  $modules = @{ como_funciona = 'ativo'; prototipo = 'ativo'; etapas = 'ativo'; editor = 'bloqueado'; versoes = 'bloqueado'; marca = 'ativo' }
  Rest 'POST' 'projects' @{ id = $projectId; client_id = $clientId; name = 'Ciclo F209'; niche = 'saas'; lead_status = 'CONVERTIDO'; project_status = 'AGENDADO'; access_status = 'ATIVO_ATE_FIM_DO_PROJETO'; access_released_at = [DateTime]::UtcNow.ToString('o'); modules = $modules; tier = 'basico' } @{ Prefer = 'return=minimal' } | Out-Null
  $script:fixtures += $projectId
  $adminToken = SignIn $adminEmail $password; $clientToken = SignIn $clientEmail $password
  Rest 'DELETE' "activity_events?project_id=eq.$projectId" | Out-Null

  if ($Scenario -in @('C2','C3','C5','C6','C7','C10','C13','C14','All')) {
    $status = Invoke-Function 'project-status-transition' @{ projectId = $projectId; target = 'V1_EM_DESENVOLVIMENTO'; requestId = "f209-c1-$nonce" } $adminToken
    Assert-True ($status.Status -eq 200 -and $status.Body.projectStatus -eq 'V1_EM_DESENVOLVIMENTO') 'C1 HTTP transition enters V1 development'
    $publish = @{ projectId = $projectId; label = 'V1'; macro = 'V1'; changelog = 'Primeira entrega'; buildReference = 'build-v1'; requestId = "f209-c2-$nonce" }
    $response = Invoke-Function 'project-publish-version' $publish $adminToken
    Assert-True ($response.Status -eq 200 -and $response.Body.versionId -and $response.Body.projectStatus -eq 'V1_PUBLICADA') "C2 HTTP V1 publication returns aggregate ($($response.Status): $($response.Body | ConvertTo-Json -Compress); request=$($publish | ConvertTo-Json -Compress))"
    Assert-True ((Rows "project_versions?project_id=eq.$projectId&select=id,label,macro,is_current").Count -eq 1) 'C2 HTTP creates one current version'
    Assert-True ((Rows "activity_events?project_id=eq.$projectId&request_id=eq.$($publish.requestId)&select=id").Count -eq 1) 'C2 HTTP creates one activity event'
    $invalid = Invoke-Function 'project-publish-version' (@{ projectId = $projectId; label = 'V3'; macro = 'V3'; changelog = 'invalid'; buildReference = 'build'; requestId = "f209-c3-$nonce" }) $adminToken
    Assert-True ($invalid.Status -eq 409) 'C3 HTTP invalid V3 state returns 409'

    if ($Scenario -in @('C5','C6','C7','C10','All')) {
      $intermediate = Invoke-Function 'project-publish-version' @{ projectId = $projectId; label = 'V1.1'; macro = 'V1'; changelog = 'Ajustes'; buildReference = 'build-v1-1'; requestId = "f209-c5-$nonce" } $adminToken
      Assert-True ($intermediate.Status -eq 200) 'C5 HTTP intermediate publication returns 200'
      Assert-True ((Rows "project_versions?project_id=eq.$projectId&is_current=eq.false&select=label,changelog,build_reference").Count -eq 1) 'C5 HTTP preserves V1 history'
    }
    if ($Scenario -in @('C6','C7','C10','All')) {
      foreach ($edge in @(@('EM_REVISAO_CLIENTE', 'review'), @('ALTERACOES_RECEBIDAS', 'feedback'), @('V2_EM_DESENVOLVIMENTO', 'v2-dev'))) {
        $edgeResponse = Invoke-Function 'project-status-transition' @{ projectId = $projectId; target = $edge[0]; requestId = "f209-c6-$($edge[1])-$nonce" } $adminToken
        Assert-True ($edgeResponse.Status -eq 200) "C11 HTTP transition $($edge[0]) returns 200"
      }
      $v2 = Invoke-Function 'project-publish-version' @{ projectId = $projectId; label = 'V2'; macro = 'V2'; changelog = 'Segunda macro'; buildReference = 'build-v2'; requestId = "f209-c6-$nonce" } $adminToken
      Assert-True ($v2.Status -eq 200 -and $v2.Body.projectStatus -eq 'V2_PUBLICADA') 'C6 HTTP V2 publication returns 200'
    }
    if ($Scenario -in @('C7','C10','All')) {
      $v3 = Invoke-Function 'project-publish-version' @{ projectId = $projectId; label = 'V3'; macro = 'V3'; changelog = 'Go-live'; buildReference = 'build-v3'; requestId = "f209-c7-$nonce" } $adminToken
      Assert-True ($v3.Status -eq 200 -and $v3.Body.projectStatus -eq 'V3_GO_LIVE') 'C7 HTTP V3 publication returns go-live'
    }
    if ($Scenario -in @('C10','All')) {
      $complete = Invoke-Function 'project-status-transition' @{ projectId = $projectId; target = 'CONCLUIDO'; requestId = "f209-c10-$nonce" } $adminToken
      Assert-True ($complete.Status -eq 200 -and $complete.Body.projectStatus -eq 'CONCLUIDO') 'C10 HTTP conclusion returns 200'
    }
  }

  if ($Scenario -in @('C13','All')) {
    $retryRequestId = if ($Scenario -eq 'All') { "f209-c5-$nonce" } else { "f209-c13-$nonce" }
    $retry = @{ projectId = $projectId; label = 'V1.1'; macro = 'V1'; changelog = 'Ajustes'; buildReference = 'build-v1-1'; requestId = $retryRequestId }
    $first = Invoke-Function 'project-publish-version' $retry $adminToken; $second = Invoke-Function 'project-publish-version' $retry $adminToken
    Assert-True ($first.Status -eq 200 -and $second.Status -eq 200 -and $second.Body.replayed) 'C13 HTTP replay returns original publication'
    Assert-True ((Rows "project_versions?project_id=eq.$projectId&label=eq.V1.1&select=id").Count -eq 1 -and (Rows "activity_events?project_id=eq.$projectId&request_id=eq.$($retry.requestId)&select=id").Count -eq 1) 'C13 HTTP retry has one row and one event'
  }

  if ($Scenario -in @('C14','All')) {
    $forbiddenPublish = Invoke-Function 'project-publish-version' (@{ projectId = $projectId; label = 'V1.2'; macro = 'V1'; changelog = 'intruso'; buildReference = 'build'; requestId = "f209-c14-publish-$nonce" }) $clientToken
    $forbiddenStatus = Invoke-Function 'project-status-transition' @{ projectId = $projectId; target = 'ALTERACOES_RECEBIDAS'; requestId = "f209-c14-status-$nonce" } $clientToken
    Assert-True ($forbiddenPublish.Status -eq 403 -and $forbiddenStatus.Status -eq 403) 'C14 CLIENT receives 403 at both write boundaries'
  }

  [pscustomobject]@{ result = 'PASS'; scenario = $Scenario; assertions = $script:passes.Count } | ConvertTo-Json -Compress
} catch {
  if (Test-Path -LiteralPath $serveOut) { [Console]::Error.WriteLine(((Get-Content $serveOut | Select-Object -Last 80) -join [Environment]::NewLine)) }
  if (Test-Path -LiteralPath $serveErr) { [Console]::Error.WriteLine(((Get-Content $serveErr | Select-Object -Last 80) -join [Environment]::NewLine)) }
  throw
} finally {
  foreach ($projectId in $script:fixtures) {
    Rest 'DELETE' "activity_events?project_id=eq.$projectId" | Out-Null
    Rest 'DELETE' "project_versions?project_id=eq.$projectId" | Out-Null
    Rest 'DELETE' "projects?id=eq.$projectId" | Out-Null
  }
  if ($clientId) { Rest 'DELETE' "memberships?client_id=eq.$clientId" | Out-Null; Rest 'DELETE' "clients?id=eq.$clientId" | Out-Null }
  foreach ($user in $script:users) { Invoke-Json 'DELETE' "$script:apiUrl/auth/v1/admin/users/$($user.Id)" $null $script:restHeaders | Out-Null }
  if ($serveProcess -and -not $serveProcess.HasExited) { Stop-Process -Id $serveProcess.Id -Force; $serveProcess.WaitForExit() }
  Remove-Item -LiteralPath $tempEnv, $serveOut, $serveErr -Force -ErrorAction SilentlyContinue
}
