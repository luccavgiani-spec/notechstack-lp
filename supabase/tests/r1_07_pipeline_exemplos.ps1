[CmdletBinding()]
param(
  [ValidateSet('C3', 'C4', 'C5', 'C6', 'All')]
  [string]$Scenario = 'All'
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$appRoot = Join-Path $projectRoot 'app'
$passes = [System.Collections.Generic.List[string]]::new()

function Assert-True([bool]$Condition, [string]$Label) {
  if (-not $Condition) { throw "ASSERTION FAILED: $Label" }
  $passes.Add($Label)
}

function Invoke-Seed([hashtable]$Environment = @{}) {
  Push-Location $appRoot
  try {
    $old = @{}
    foreach ($entry in $Environment.GetEnumerator()) {
      $old[$entry.Key] = [Environment]::GetEnvironmentVariable($entry.Key)
      [Environment]::SetEnvironmentVariable($entry.Key, [string]$entry.Value, 'Process')
    }
    $output = @(& npm run seed:exemplos 2>&1)
    $exitCode = $LASTEXITCODE
    foreach ($entry in $Environment.GetEnumerator()) {
      [Environment]::SetEnvironmentVariable($entry.Key, $old[$entry.Key], 'Process')
    }
    [pscustomobject]@{ ExitCode = $exitCode; Output = ($output -join "`n") }
  } finally {
    Pop-Location
  }
}

function Query([string]$Sql) {
  $output = @(& supabase db query --local --output csv $Sql 2>&1)
  if ($LASTEXITCODE -ne 0) { throw "snapshot query failed: $($output -join "`n")" }
  ($output -join "`n")
}

try {
  $first = Invoke-Seed
  Assert-True ($first.ExitCode -eq 0) 'C3 seed exits 0 and creates the examples'

  $snapshot = Query "select c.slug, count(distinct p.id) as projects, count(k.id) as items, count(k.id) filter (where k.status = 'concluido') as completed from public.clients c left join public.projects p on p.client_id = c.id left join public.kanban_items k on k.project_id = p.id where c.slug in ('gazeta-bragantina', 'hello-best') group by c.slug order by c.slug;"
  Assert-True ($snapshot -match 'gazeta-bragantina,1,27,17') 'C3 Gazeta has one project, 27 items and 17 concluded'
  Assert-True ($snapshot -match 'hello-best,1,0,0') 'C5 Hello Best has one project and no Kanban items'

  $states = Query "select c.slug, p.lead_status::text, coalesce(p.project_status::text, '') as project_status, coalesce(p.access_status::text, '') as access_status, coalesce(r.prototype_url, '') as prototype_url from public.clients c join public.projects p on p.client_id = c.id left join public.roadmaps r on r.project_id = p.id where c.slug in ('gazeta-bragantina', 'hello-best') order by c.slug;"
  Assert-True ($states -match 'gazeta-bragantina,CONVERTIDO,CONVERTIDO,ATIVO_ATE_FIM_DO_PROJETO') 'C3 Gazeta statuses match the pipeline contract'
  Assert-True ($states -match 'hello-best,EM_PRODUCAO,,,https://hello-best\.lovable\.app') 'C5 Hello Best status and prototype URL match the source contract'

  $phaseSnapshot = Query "select distinct k.phase::text from public.kanban_items k join public.projects p on p.id = k.project_id join public.clients c on c.id = p.client_id where c.slug = 'gazeta-bragantina' order by k.phase;"
  foreach ($phase in @('Fase 0 · Preparação', 'Fase 1 · Frontend', 'Fase 2 · Migração e Backup', 'Fase 3 · Editorial e Backend', 'Fase 4 · Go-live')) {
    Assert-True ($phaseSnapshot.Contains($phase)) "C4 source phase is persisted: $phase"
  }

  if ($Scenario -in @('C6', 'All')) {
    $second = Invoke-Seed
    Assert-True ($second.ExitCode -eq 0) 'C6 second seed exits 0'
    $failed = Invoke-Seed @{ SEED_EXEMPLOS_FAIL_AFTER = 'gazeta' }
    Assert-True ($failed.ExitCode -eq 1) 'C6 injected mid-seed failure exits 1'
    $afterFailure = Query "select c.slug, count(distinct p.id) as projects, count(k.id) as items from public.clients c left join public.projects p on p.client_id = c.id left join public.kanban_items k on k.project_id = p.id where c.slug in ('gazeta-bragantina','hello-best') group by c.slug order by c.slug;"
    Assert-True ($afterFailure -match 'gazeta-bragantina,1,27' -and $afterFailure -match 'hello-best,1,0') 'C6 failed transaction leaves the prior snapshot intact'
    $third = Invoke-Seed
    Assert-True ($third.ExitCode -eq 0) 'C6 retry after failure exits 0'
    $events = Query "select count(*) as seed_events from public.activity_events where type like 'seed.%' or request_id like 'seed:%';"
    Assert-True ($events -match '(?m)^0$') 'C6 seed does not duplicate seed activity events'
  }

  [pscustomobject]@{ result = 'PASS'; scenario = $Scenario; assertions = $passes.Count } | ConvertTo-Json -Compress
} catch {
  Write-Error $_
  exit 1
}
