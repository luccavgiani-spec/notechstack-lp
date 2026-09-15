[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$appRoot = Join-Path $projectRoot 'app'
$supabase = (Get-Command supabase -ErrorAction Stop).Source
$npm = (Get-Command npm -ErrorAction Stop).Source
$tempEnv = [IO.Path]::GetTempFileName()
$serveOut = [IO.Path]::GetTempFileName()
$serveErr = [IO.Path]::GetTempFileName()
$serveProcess = $null
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
    $params.Body = ($Body | ConvertTo-Json -Depth 30 -Compress)
  }
  $response = Invoke-WebRequest @params
  $parsed = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }
  return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = $parsed; Headers = $response.Headers }
}

function Assert-True([bool]$Condition, [string]$Label) {
  if (-not $Condition) { throw "ASSERTION FAILED: $Label" }
  $passes.Add($Label)
}

function Get-Rows([string]$TableAndQuery, [string]$Token = $script:serviceRoleKey) {
  $headers = @{ apikey = $script:serviceRoleKey; Authorization = "Bearer $Token" }
  $response = Invoke-Json 'GET' "$script:apiUrl/rest/v1/$TableAndQuery" $null $headers
  if ($response.Status -ne 200) { throw "REST GET failed: $TableAndQuery ($($response.Status))" }
  return @($response.Body)
}

function Insert-Row([string]$Table, [hashtable]$Row) {
  $headers = @{
    apikey = $script:serviceRoleKey
    Authorization = "Bearer $($script:serviceRoleKey)"
    Prefer = 'return=representation'
  }
  $result = Invoke-Json 'POST' "$script:apiUrl/rest/v1/$Table" $Row $headers
  if ($result.Status -notin @(200, 201)) { throw "REST insert failed: $Table ($($result.Status))" }
  return @($result.Body)[0]
}

function New-AuthUser([string]$Email, [string]$Password, [string]$Role, [bool]$EmailConfirm = $true) {
  $result = Invoke-Json 'POST' "$script:apiUrl/auth/v1/admin/users" @{
    email = $Email
    password = $Password
    email_confirm = $EmailConfirm
    app_metadata = @{ role = $Role }
  } $script:adminHeaders
  if ($result.Status -notin @(200, 201)) { throw "Auth user create failed ($($result.Status))" }
  return $result.Body
}

function Test-JsonEqual($Left, $Right) {
  $leftNode = [System.Text.Json.Nodes.JsonNode]::Parse(($Left | ConvertTo-Json -Depth 30 -Compress))
  $rightNode = [System.Text.Json.Nodes.JsonNode]::Parse(($Right | ConvertTo-Json -Depth 30 -Compress))
  return [System.Text.Json.Nodes.JsonNode]::DeepEquals($leftNode, $rightNode)
}

function Sign-In([string]$Email, [string]$Password) {
  $result = Invoke-Json 'POST' "$script:apiUrl/auth/v1/token?grant_type=password" @{
    email = $Email
    password = $Password
  } @{ apikey = $script:anonKey }
  if ($result.Status -ne 200) { throw "Sign-in failed ($($result.Status))" }
  return $result.Body
}

function Count-AuthEmail([string]$Email) {
  $result = Invoke-Json 'GET' "$script:apiUrl/auth/v1/admin/users?page=1&per_page=1000" $null $script:adminHeaders
  if ($result.Status -ne 200) { throw "Auth list failed ($($result.Status))" }
  return @($result.Body.users | Where-Object { $_.email -eq $Email }).Count
}

function New-Project([string]$State, [string]$Suffix, [string]$Email = '') {
  $clientId = [guid]::NewGuid().ToString()
  $projectId = [guid]::NewGuid().ToString()
  if (-not $Email) { $Email = "r104-$Suffix-$($script:runId)@example.test" }
  $client = Insert-Row 'clients' @{
    id = $clientId
    name = "Cliente $Suffix"
    slug = "r104-$Suffix-$($script:runId)"
    email = $Email
  }
  $projectValues = @{
    id = $projectId
    client_id = $client.id
    name = "Projeto $Suffix"
    lead_status = if ($State -eq 'ARQUIVADO') { 'ROADMAP_PAGO' } else { $State }
  }
  if ($State -eq 'ARQUIVADO') { $projectValues.project_status = 'ARQUIVADO' }
  $project = Insert-Row 'projects' $projectValues
  return [pscustomobject]@{ Id = [string]$project.id; ClientId = [string]$client.id; Email = $Email }
}

function Invoke-Skill([string]$ProjectId, $Content, [string]$Token = $script:adminToken) {
  return Invoke-Json 'POST' "$script:apiUrl/functions/v1/skill-01-ativar-dashboard" @{
    projectId = $ProjectId
    content = $Content
  } @{ apikey = $script:anonKey; Authorization = "Bearer $Token" }
}

function Invoke-Cli([string]$ProjectId, [string]$ContentPath, [string]$Token) {
  $env:SUPABASE_URL = $script:apiUrl
  $env:SUPABASE_ANON_KEY = $script:anonKey
  $env:NO_ADMIN_ACCESS_TOKEN = $Token
  Push-Location $appRoot
  try {
    $output = & $npm run skill:01 -- $ProjectId $ContentPath 2>&1 | Out-String
    return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $output }
  } finally {
    Pop-Location
  }
}

function Public-Vector([string]$ProjectId, [string]$Email) {
  $project = (Get-Rows "projects?id=eq.$ProjectId&select=client_id,lead_status,access_released_at")[0]
  return @(
    (Count-AuthEmail $Email),
    (Get-Rows "memberships?client_id=eq.$($project.client_id)&select=id").Count,
    (Get-Rows "roadmaps?project_id=eq.$ProjectId&select=project_id").Count,
    (Get-Rows "activity_events?project_id=eq.$ProjectId&select=id").Count,
    ($project | ConvertTo-Json -Compress)
  ) -join '|'
}

function Parse-Fragment([string]$Location) {
  $values = @{}
  $fragment = ([uri]$Location).Fragment.TrimStart('#')
  foreach ($pair in $fragment -split '&') {
    $parts = $pair -split '=', 2
    if ($parts.Count -eq 2) {
      $values[[uri]::UnescapeDataString($parts[0])] = [uri]::UnescapeDataString($parts[1])
    }
  }
  return $values
}

function Invoke-NoRedirect([string]$Uri) {
  $handler = [Net.Http.HttpClientHandler]::new()
  $handler.AllowAutoRedirect = $false
  $client = [Net.Http.HttpClient]::new($handler)
  try {
    $response = $client.GetAsync($Uri).GetAwaiter().GetResult()
    return [pscustomobject]@{
      StatusCode = [int]$response.StatusCode
      Headers = @{ Location = [string]$response.Headers.Location }
    }
  } finally {
    $client.Dispose()
    $handler.Dispose()
  }
}

try {
  $statusLines = & $supabase status -o env 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Supabase local stack is not available' }
  $script:apiUrl = Get-StatusValue $statusLines 'API_URL'
  $script:anonKey = Get-StatusValue $statusLines 'ANON_KEY'
  $script:serviceRoleKey = Get-StatusValue $statusLines 'SERVICE_ROLE_KEY'
  $script:adminHeaders = @{ apikey = $script:serviceRoleKey; Authorization = "Bearer $($script:serviceRoleKey)" }

  [IO.File]::WriteAllText($tempEnv, "APP_URL=http://127.0.0.1:5174`n")
  $serveProcess = Start-Process -FilePath $supabase -ArgumentList @('functions', 'serve', '--no-verify-jwt', '--env-file', $tempEnv) `
    -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $serveOut -RedirectStandardError $serveErr -PassThru

  $deadline = [DateTime]::UtcNow.AddSeconds(75)
  do {
    if ($serveProcess.HasExited) { throw "Functions server exited early with code $($serveProcess.ExitCode)" }
    try {
      $warm = Invoke-Json 'POST' "$script:apiUrl/functions/v1/skill-01-ativar-dashboard" @{} @{ apikey = $script:anonKey }
      if ($warm.Status -eq 401) { break }
    } catch { }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)
  Assert-True ($warm.Status -eq 401) 'C11 função autenticada fica pronta e recusa ausência de sessão'

  $adminEmail = "r104-admin-$($script:runId)@example.test"
  $adminPassword = 'R104-admin-password-123!'
  $clientEmail = "r104-client-$($script:runId)@example.test"
  $clientPassword = 'R104-client-password-123!'
  $adminUser = New-AuthUser $adminEmail $adminPassword 'NO_ADMIN'
  $clientUser = New-AuthUser $clientEmail $clientPassword 'CLIENT'
  $script:adminToken = (Sign-In $adminEmail $adminPassword).access_token
  $clientToken = (Sign-In $clientEmail $clientPassword).access_token
  Assert-True ($adminUser.app_metadata.role -eq 'NO_ADMIN' -and $clientUser.app_metadata.role -eq 'CLIENT') 'C3 fixtures usam papéis NO_ADMIN e CLIENT reais'

  $contentPath = Join-Path $projectRoot 'app\scripts\exemplos\roadmap-exemplo.json'
  $content = Get-Content $contentPath -Raw | ConvertFrom-Json -AsHashtable
  $activated = @()
  foreach ($state in @('ROADMAP_PAGO', 'REFERENCIAS_PENDENTES', 'EM_PRODUCAO')) {
    $project = New-Project $state $state.ToLowerInvariant()
    $cli = Invoke-Cli $project.Id $contentPath $script:adminToken
    $linkMatch = [regex]::Match($cli.Output, 'Convite:\s*(\S+)')
    if ($cli.ExitCode -ne 0 -or -not $linkMatch.Success) {
      $safeOutput = $cli.Output -replace 'Convite:\s*\S+', 'Convite: <redacted>'
      throw "CLI failed for $state with exit $($cli.ExitCode): $safeOutput"
    }
    Assert-True ($cli.ExitCode -eq 0 -and $linkMatch.Success) "C1 CLI libera projeto em $state e imprime convite"
    $projectRow = (Get-Rows "projects?id=eq.$($project.Id)&select=lead_status,access_status,access_released_at,modules")[0]
    $roadmapRow = (Get-Rows "roadmaps?project_id=eq.$($project.Id)&select=answers,references,stack,costs,next_steps,tiers,preferred_tier,prototype_url,published_at")[0]
    $membershipRows = Get-Rows "memberships?client_id=eq.$($project.ClientId)&select=user_id,role"
    Assert-True (
      (Count-AuthEmail $project.Email) -eq 1 -and $membershipRows.Count -eq 1 -and $membershipRows[0].role -eq 'CLIENT' -and
      $projectRow.lead_status -eq 'JANELA_DE_DECISAO' -and $projectRow.access_status -eq 'INICIAL_15_DIAS' -and
      $null -ne $projectRow.access_released_at -and $null -ne $roadmapRow.published_at -and
      (Test-JsonEqual $roadmapRow.answers $content.answers) -and
      (Test-JsonEqual $roadmapRow.references $content.references) -and
      (Test-JsonEqual $roadmapRow.stack $content.stack) -and
      (Test-JsonEqual $roadmapRow.costs $content.costs) -and
      (Test-JsonEqual $roadmapRow.next_steps $content.next_steps) -and
      (Test-JsonEqual $roadmapRow.tiers $content.tiers) -and
      $roadmapRow.preferred_tier -eq $content.preferred_tier -and
      $roadmapRow.prototype_url -eq $content.prototype_url -and
      $projectRow.modules.como_funciona -eq 'ativo' -and $projectRow.modules.prototipo -eq 'ativo' -and
      $projectRow.modules.etapas -eq 'ativo' -and $projectRow.modules.editor -eq 'bloqueado' -and
      $projectRow.modules.versoes -eq 'bloqueado' -and $projectRow.modules.marca -eq 'bloqueado'
    ) "C1 agregado exato é publicado para $state"
    $activated += [pscustomobject]@{ Project = $project; Link = $linkMatch.Groups[1].Value; Release = [string]$projectRow.access_released_at }
  }

  $reuseEmail = "r104-reuse-$($script:runId)@example.test"
  $originProject = New-Project 'ROADMAP_PAGO' 'reuse-origin' $reuseEmail
  $reuseUser = New-AuthUser $reuseEmail 'R104-reuse-password-123!' 'CLIENT' $false
  $null = Insert-Row 'memberships' @{ client_id = $originProject.ClientId; user_id = $reuseUser.id; role = 'CLIENT' }
  $targetProject = New-Project 'ROADMAP_PAGO' 'reuse-target' $reuseEmail
  $reuseResponse = Invoke-Skill $targetProject.Id $content
  $reuseMemberships = Get-Rows "memberships?user_id=eq.$($reuseUser.id)&select=client_id"
  Assert-True (
    $reuseResponse.Status -eq 200 -and (Count-AuthEmail $reuseEmail) -eq 1 -and
    $reuseMemberships.Count -eq 2 -and
    @($reuseMemberships.client_id) -contains $originProject.ClientId -and
    @($reuseMemberships.client_id) -contains $targetProject.ClientId
  ) 'C1 usuário existente é reutilizado entre dois tenants com memberships distintas'

  $primary = $activated[0]
  $activity = Get-Rows "activity_events?project_id=eq.$($primary.Project.Id)&type=eq.skill_01_dashboard_ativado&select=actor_id,request_id,occurred_at"
  Assert-True ($activity.Count -eq 1 -and $activity[0].actor_id -eq $adminUser.id -and $null -ne $activity[0].occurred_at) 'C2 activity identifica operador e projeto'

  $unauthProject = New-Project 'ROADMAP_PAGO' 'unauth'
  $beforeUnauth = Public-Vector $unauthProject.Id $unauthProject.Email
  $noSession = Invoke-Json 'POST' "$script:apiUrl/functions/v1/skill-01-ativar-dashboard" @{ projectId = $unauthProject.Id; content = $content } @{ apikey = $script:anonKey }
  $clientAttempt = Invoke-Skill $unauthProject.Id $content $clientToken
  $afterUnauth = Public-Vector $unauthProject.Id $unauthProject.Email
  Assert-True ($noSession.Status -eq 401 -and $clientAttempt.Status -eq 403 -and $beforeUnauth -eq $afterUnauth) 'C3 sem sessão 401 e CLIENT 403 com delta zero'

  $invalidProject = New-Project 'ROADMAP_PAGO' 'invalid-content'
  $beforeInvalid = Public-Vector $invalidProject.Id $invalidProject.Email
  $invalidContent = $content.Clone()
  $invalidContent.Remove('tiers')
  $invalid = Invoke-Skill $invalidProject.Id $invalidContent
  $afterInvalid = Public-Vector $invalidProject.Id $invalidProject.Email
  Assert-True ($invalid.Status -eq 422 -and @($invalid.Body.invalidFields) -contains 'tiers' -and $beforeInvalid -eq $afterInvalid) 'C4 fronteira retorna 422 com invalidFields e delta zero'

  foreach ($state in @('CONVERTIDO', 'ARQUIVADO')) {
    $rejected = New-Project $state "rejected-$($state.ToLowerInvariant())"
    $beforeRejected = Public-Vector $rejected.Id $rejected.Email
    $response = Invoke-Skill $rejected.Id $content
    $afterRejected = Public-Vector $rejected.Id $rejected.Email
    Assert-True ($response.Status -eq 409 -and $response.Body.currentState -eq $state -and $beforeRejected -eq $afterRejected -and (Count-AuthEmail $rejected.Email) -eq 0) "C5 $state compensa usuário novo e linhas públicas"
  }

  $badEmailProject = New-Project 'ROADMAP_PAGO' 'auth-unavailable' 'email-invalido'
  $badEmailBefore = Public-Vector $badEmailProject.Id $badEmailProject.Email
  $badEmail = Invoke-Skill $badEmailProject.Id $content
  Assert-True ($badEmail.Status -eq 502 -and $badEmail.Body.error_code -eq 'AUTH_UNAVAILABLE' -and $badEmailBefore -eq (Public-Vector $badEmailProject.Id $badEmailProject.Email)) 'C5 falha do Auth retorna 502 sem escrita pública'

  $retry = Invoke-Skill $primary.Project.Id $content
  $retryMemberships = Get-Rows "memberships?client_id=eq.$($primary.Project.ClientId)&select=id"
  $retryProject = (Get-Rows "projects?id=eq.$($primary.Project.Id)&select=access_released_at")[0]
  Assert-True ($retry.Status -eq 200 -and $retry.Body.inviteLink -ne $primary.Link -and (Count-AuthEmail $primary.Project.Email) -eq 1 -and $retryMemberships.Count -eq 1 -and [string]$retryProject.access_released_at -eq $primary.Release) 'C6 retry troca convite sem duplicar ou reiniciar acesso'
  Assert-True ((Get-Rows "activity_events?project_id=eq.$($primary.Project.Id)&type=eq.skill_01_dashboard_ativado&select=id").Count -eq 1) 'C6 retry mantém uma atividade de ativação'

  $inviteResponse = Invoke-NoRedirect $retry.Body.inviteLink
  $inviteLocation = [string]$inviteResponse.Headers.Location
  $inviteFragment = Parse-Fragment $inviteLocation
  $inviteUser = Invoke-Json 'GET' "$script:apiUrl/auth/v1/user" $null @{ apikey = $script:anonKey; Authorization = "Bearer $($inviteFragment.access_token)" }
  Assert-True ($inviteResponse.StatusCode -in @(302, 303) -and $inviteLocation.Contains("/acesso?projectId=$($primary.Project.Id)") -and $inviteFragment.access_token -and $inviteUser.Status -eq 200 -and $inviteUser.Body.app_metadata.role -eq 'CLIENT') 'C7 convite local redireciona para o projeto com sessão CLIENT'

  $newPassword = 'R104-new-client-password-123!'
  $passwordUpdate = Invoke-Json 'PUT' "$script:apiUrl/auth/v1/user" @{ password = $newPassword } @{ apikey = $script:anonKey; Authorization = "Bearer $($inviteFragment.access_token)" }
  $newSession = Sign-In $primary.Project.Email $newPassword
  $visibleProjects = Get-Rows "projects?id=eq.$($primary.Project.Id)&select=id" $newSession.access_token
  Assert-True ($passwordUpdate.Status -eq 200 -and $newSession.user.email -eq $primary.Project.Email -and $newSession.user.app_metadata.role -eq 'CLIENT' -and $visibleProjects.Count -eq 1) 'C7 token é aceito uma vez, senha entra como CLIENT e membership alcança o projeto'

  $authCountBeforeReuse = Count-AuthEmail $primary.Project.Email
  $membershipCountBeforeReuse = (Get-Rows "memberships?client_id=eq.$($primary.Project.ClientId)&select=id").Count
  $usedResponse = Invoke-NoRedirect $retry.Body.inviteLink
  $usedLocation = [string]$usedResponse.Headers.Location
  Assert-True ($usedResponse.StatusCode -in @(302, 303) -and $usedLocation -match 'error|otp_expired' -and (Count-AuthEmail $primary.Project.Email) -eq $authCountBeforeReuse -and (Get-Rows "memberships?client_id=eq.$($primary.Project.ClientId)&select=id").Count -eq $membershipCountBeforeReuse) 'C8 convite usado não cria segunda sessão identidade ou membership'

  $env:SUPABASE_URL = $script:apiUrl
  $env:SUPABASE_ANON_KEY = $script:anonKey
  $env:NO_ADMIN_ACCESS_TOKEN = $script:adminToken
  Push-Location $appRoot
  try {
    $missingOutput = & $npm run skill:01 -- 2>&1 | Out-String
    $missingExit = $LASTEXITCODE
    $env:NO_ADMIN_ACCESS_TOKEN = 'token-invalido-r104'
    $failedOutput = & $npm run skill:01 -- $primary.Project.Id $contentPath 2>&1 | Out-String
    $failedExit = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  Assert-True ($missingExit -eq 2 -and $failedExit -eq 1 -and -not $failedOutput.Contains('token-invalido-r104')) 'C11 CLI usa códigos 2 e 1 e não imprime token'

  [pscustomobject]@{
    result = 'PASS'
    assertions = $passes.Count
    checks = @('C1','C2','C3','C4','C5','C6','C7','C8','C11')
  } | ConvertTo-Json -Compress
} catch {
  if (Test-Path -LiteralPath $serveOut) { [Console]::Error.WriteLine(((Get-Content $serveOut | Select-Object -Last 100) -join [Environment]::NewLine)) }
  if (Test-Path -LiteralPath $serveErr) { [Console]::Error.WriteLine(((Get-Content $serveErr | Select-Object -Last 100) -join [Environment]::NewLine)) }
  throw
} finally {
  foreach ($process in @($serveProcess)) {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force
      $process.WaitForExit()
    }
  }
  Remove-Item -LiteralPath $tempEnv, $serveOut, $serveErr -Force -ErrorAction SilentlyContinue
  Remove-Item Env:SUPABASE_URL, Env:SUPABASE_ANON_KEY, Env:NO_ADMIN_ACCESS_TOKEN -ErrorAction SilentlyContinue
}
