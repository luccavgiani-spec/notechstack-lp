[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$supabase = (Get-Command supabase -ErrorAction Stop).Source
$panelToken = 'r1-02-local-panel-token'
$sid = 'r1-02-' + [guid]::NewGuid().ToString('N')
$eventCount = 3
$tempEnv = [IO.Path]::GetTempFileName()
$tempStdout = [IO.Path]::GetTempFileName()
$tempStderr = [IO.Path]::GetTempFileName()
$serveProcess = $null

function Get-StatusValue([string[]]$Lines, [string]$Name) {
  $match = $Lines | Select-String -Pattern ('^' + [regex]::Escape($Name) + '="([^"]+)"$') | Select-Object -First 1
  if (-not $match) {
    throw "Supabase local status did not return $Name"
  }
  return $match.Matches[0].Groups[1].Value
}

function Get-EventCount([string]$Uri, [hashtable]$Headers) {
  $countHeaders = @{} + $Headers
  $countHeaders['Prefer'] = 'count=exact'
  $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -Headers $countHeaders
  $contentRange = $response.Headers['Content-Range']
  $countMatch = [regex]::Match([string]$contentRange, '/(\d+)$')
  if (-not $countMatch.Success) {
    throw "PostgREST did not return an exact row count for lead_eventos: $contentRange"
  }
  return [int]$countMatch.Groups[1].Value
}

try {
  $statusLines = & $supabase status -o env 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw 'Supabase local stack is not available'
  }

  $apiUrl = Get-StatusValue $statusLines 'API_URL'
  $serviceRoleKey = Get-StatusValue $statusLines 'SERVICE_ROLE_KEY'
  $restHeaders = @{
    apikey = $serviceRoleKey
    Authorization = "Bearer $serviceRoleKey"
  }

  # The token is synthetic, exists only in the OS temp directory during this run,
  # and is removed in finally. No .env file in the repository is read or written.
  [IO.File]::WriteAllText($tempEnv, "PAINEL_TOKEN=$panelToken`n")
  $serveProcess = Start-Process `
    -FilePath $supabase `
    -ArgumentList @('functions', 'serve', '--no-verify-jwt', '--env-file', $tempEnv) `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $tempStdout `
    -RedirectStandardError $tempStderr `
    -PassThru

  $panelUri = "$apiUrl/functions/v1/painel-dados?v=funil&dias=7"
  $panelResponse = $null
  $deadline = [DateTime]::UtcNow.AddSeconds(45)
  while ([DateTime]::UtcNow -lt $deadline) {
    if ($serveProcess.HasExited) {
      throw "Edge Functions server exited early with code $($serveProcess.ExitCode)"
    }
    try {
      $panelResponse = Invoke-WebRequest -UseBasicParsing -Uri $panelUri -Headers @{ 'x-painel-token' = $panelToken }
      if ($panelResponse.StatusCode -eq 200) { break }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  if (-not $panelResponse -or $panelResponse.StatusCode -ne 200) {
    throw 'painel-dados did not return HTTP 200 within 45 seconds'
  }

  $trackUri = "$apiUrl/functions/v1/track-evento"
  $warmupPayload = @{
    sid = "$sid-warmup"
    eventos = @()
  } | ConvertTo-Json -Depth 4 -Compress
  $warmupResponse = $null
  $deadline = [DateTime]::UtcNow.AddSeconds(20)
  while ([DateTime]::UtcNow -lt $deadline) {
    if ($serveProcess.HasExited) {
      throw "Edge Functions server exited early with code $($serveProcess.ExitCode)"
    }
    try {
      $warmupResponse = Invoke-WebRequest `
        -UseBasicParsing `
        -Method Post `
        -Uri $trackUri `
        -ContentType 'application/json' `
        -Body $warmupPayload
      if ($warmupResponse.StatusCode -eq 200) { break }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  if (-not $warmupResponse -or $warmupResponse.StatusCode -ne 200) {
    throw 'track-evento did not become ready within 20 seconds'
  }

  $eventsUri = "$apiUrl/rest/v1/lead_eventos?sid=eq.$sid&select=id"
  $beforeRows = Get-EventCount $eventsUri $restHeaders

  $payload = @{
    sid = $sid
    eventos = @(
      @{ evento = 'cta_click'; etapa = 1; params = @{ source = 'r1-02-local' } }
      @{ evento = 'form_aberto'; etapa = 3; params = @{ source = 'r1-02-local' } }
      @{ evento = 'form_avancou'; etapa = 4; params = @{ source = 'r1-02-local' } }
    )
  } | ConvertTo-Json -Depth 8 -Compress

  $trackResponse = Invoke-WebRequest `
    -UseBasicParsing `
    -Method Post `
    -Uri $trackUri `
    -ContentType 'application/json' `
    -Body $payload
  $trackBody = $trackResponse.Content | ConvertFrom-Json
  $afterRows = Get-EventCount $eventsUri $restHeaders

  if ($trackResponse.StatusCode -ne 200) {
    throw "track-evento returned HTTP $($trackResponse.StatusCode)"
  }
  if ($trackBody.gravados -ne $eventCount) {
    throw "track-evento reported $($trackBody.gravados) writes; expected $eventCount"
  }
  if (($afterRows - $beforeRows) -ne $eventCount) {
    throw "lead_eventos grew by $($afterRows - $beforeRows); expected $eventCount"
  }

  [pscustomobject]@{
    painel_status = $panelResponse.StatusCode
    track_status = $trackResponse.StatusCode
    eventos_enviados = $eventCount
    eventos_gravados = $afterRows - $beforeRows
  } | ConvertTo-Json -Compress
} catch {
  $failure = $_
  if (Test-Path -LiteralPath $tempStdout) {
    [Console]::Error.WriteLine(((Get-Content -LiteralPath $tempStdout | Select-Object -Last 40) -join [Environment]::NewLine))
  }
  if (Test-Path -LiteralPath $tempStderr) {
    [Console]::Error.WriteLine(((Get-Content -LiteralPath $tempStderr | Select-Object -Last 40) -join [Environment]::NewLine))
  }
  throw $failure
} finally {
  if ($serveProcess -and -not $serveProcess.HasExited) {
    Stop-Process -Id $serveProcess.Id -Force
    $serveProcess.WaitForExit()
  }
  Remove-Item -LiteralPath $tempEnv, $tempStdout, $tempStderr -Force -ErrorAction SilentlyContinue
}
