# Provas V1–V7 do hub de marketing com os segredos digitados de forma mascarada.
# Os valores vivem só neste processo: não vão para arquivo, histórico nem log.
# Uso:  powershell -ExecutionPolicy Bypass -File supabase/tests/hub_marketing_viabilidade.ps1 [-ExecutarEscritas]
[CmdletBinding()]
param([switch]$ExecutarEscritas)

$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Ler-Segredo([string]$Nome) {
  $seguro = Read-Host "$Nome (colar; não aparece)" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
  try { [Environment]::SetEnvironmentVariable($Nome, [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr), 'Process') }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Ler-Valor([string]$Nome, [string]$Padrao = '') {
  $texto = Read-Host "$Nome$(if ($Padrao) { " [$Padrao]" })"
  if (-not $texto) { $texto = $Padrao }
  [Environment]::SetEnvironmentVariable($Nome, $texto, 'Process')
}

Write-Host 'Segredos (Enter vazio pula a prova que depende dele):'
foreach ($n in 'META_SYSTEM_USER_TOKEN', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN', 'GOOGLE_ADS_DEVELOPER_TOKEN') { Ler-Segredo $n }

Write-Host "`nIds (não são segredo):"
Ler-Valor 'GOOGLE_OAUTH_CLIENT_ID'
Ler-Valor 'META_AD_ACCOUNT_ID' 'act_1415926037237997'
Ler-Valor 'META_IG_USER_ID'
Ler-Valor 'V3_IMAGE_URL'
Ler-Valor 'GOOGLE_ADS_CUSTOMER_ID' '930-207-4409'
Ler-Valor 'GOOGLE_ADS_LOGIN_CUSTOMER_ID'
Ler-Valor 'GA4_PROPERTY_ID' '531794428'
Ler-Valor 'GSC_SITE_URL' 'https://www.notechstack.com.br/'

$argumentos = @('supabase/tests/hub_marketing_viabilidade.mjs')
if ($ExecutarEscritas) { $argumentos += '--executar-escritas' }
Push-Location $raiz
try { node @argumentos } finally { Pop-Location }
