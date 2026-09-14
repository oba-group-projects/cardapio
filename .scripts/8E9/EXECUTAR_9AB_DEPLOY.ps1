#Requires -Version 5.1
# DEPLOY AUTOMATIZADO — FASES 9A + 9B
# Uso: duplo-clique em EXECUTAR-9AB-DEPLOY.cmd na raiz do projeto

$ErrorActionPreference = "Continue"
Set-StrictMode -Off

function Pass($m) { Write-Host "[PASS] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Fail($m) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host " FALHA NO DEPLOY 9A+9B" -ForegroundColor Red
    Write-Host " $m" -ForegroundColor Red
    Write-Host " A producao nao foi alterada (gate protege)." -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    exit 1
}

# Executa wrangler.cmd usando ProcessStartInfo (unico metodo que funciona
# corretamente com o wrangler.cmd local no Windows/PowerShell sem janela separada)
function Run-Wrangler {
    param([string]$WranglerArgs, [int]$TimeoutSec = 180)
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName         = $script:wrangler
    $psi.Arguments        = $WranglerArgs
    $psi.WorkingDirectory = $script:gestao
    $psi.UseShellExecute  = $false
    $psi.CreateNoWindow   = $false
    $p = [System.Diagnostics.Process]::new()
    $p.StartInfo = $psi
    $p.Start() | Out-Null
    $done = $p.WaitForExit($TimeoutSec * 1000)
    if (-not $done) { try { $p.Kill() } catch {}; throw "TIMEOUT ($($TimeoutSec)s): wrangler $WranglerArgs" }
    return $p.ExitCode
}

# Valida sintaxe JS via node --check (captura stderr para nao poluir console)
function Check-JS {
    param([string]$File)
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = "C:\Program Files\nodejs\node.exe"
    $psi.Arguments = "--check `"$File`""
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow  = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError  = $true
    $p = [System.Diagnostics.Process]::new()
    $p.StartInfo = $psi
    $p.Start() | Out-Null
    $p.WaitForExit(30000) | Out-Null
    return $p.ExitCode
}

# ----------------------------------------------------------------
$root     = "C:\Users\pc_fa\Documents\Projeto_Gemini"
$gestao   = Join-Path $root "online\gestao"
$wrangler = Join-Path $gestao "node_modules\.bin\wrangler.cmd"
$baseUrl  = "https://oba-cardapio-gestao.obadoceria.workers.dev"
$branchExpected = "feature/gestao-online-segura"

$workerPath    = Join-Path $gestao "src\index.js"
$centralPath   = Join-Path $gestao "public\index.html"
$themePath     = Join-Path $gestao "public\data\catalog-v1\theme.json"
$bootstrapPath = Join-Path $gestao "public\preview-bootstrap.js"

Set-Location $root

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " DEPLOY FASES 9A + 9B - TEMA VISUAL E EDICAO VISUAL" -ForegroundColor Cyan
Write-Host " Worker + Assets -> Cloudflare Workers" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# ── 1/7 Baseline ─────────────────────────────────────────────────
Write-Host "`n[1/7] Validando baseline..." -ForegroundColor Yellow
$branch = (git -C $root branch --show-current 2>&1).ToString().Trim()
$head   = (git -C $root rev-parse --short HEAD 2>&1).ToString().Trim()
Write-Host "Branch : $branch  |  HEAD : $head"
if ($branch -ne $branchExpected)  { Fail "Branch incorreta: '$branch'" }
if (-not (Test-Path $wrangler))    { Fail "wrangler.cmd nao encontrado: $wrangler" }
if (-not (Test-Path $workerPath))  { Fail "Worker ausente: $workerPath" }
if (-not (Test-Path $centralPath)) { Fail "Central ausente: $centralPath" }
if (-not (Test-Path $themePath))   { Fail "theme.json ausente: $themePath" }
$htmlContent = Get-Content $centralPath -Raw
if ($htmlContent -notlike '*data-tab="visual"*')  { Fail "Aba Edicao Visual ausente no HTML." }
if ($htmlContent -notlike '*obaPopularFormTema*')  { Fail "obaPopularFormTema ausente no HTML." }
try {
    $tj = Get-Content $themePath -Raw | ConvertFrom-Json
    if (-not $tj.paginas) { Fail "theme.json: campo 'paginas' ausente." }
} catch { Fail "theme.json invalido: $_" }
Pass "BASELINE VALIDADA - HEAD $head"

# ── 2/7 Sintaxe JS ───────────────────────────────────────────────
Write-Host "`n[2/7] Validando sintaxe JS..." -ForegroundColor Yellow
if ((Check-JS $workerPath)    -ne 0) { Fail "Sintaxe invalida: $workerPath" }
Pass "Worker: sintaxe OK"
if ((Check-JS $bootstrapPath) -ne 0) { Fail "Sintaxe invalida: $bootstrapPath" }
Pass "preview-bootstrap.js: sintaxe OK"

# ── 3/7 Dry-run ──────────────────────────────────────────────────
Write-Host "`n[3/7] Wrangler dry-run..." -ForegroundColor Yellow
if ((Run-Wrangler "deploy --dry-run") -ne 0) { Fail "Dry-run falhou." }
Pass "DRY-RUN APROVADO"

# ── 4/7 Checkpoint ───────────────────────────────────────────────
Write-Host "`n[4/7] Checkpoint de seguranca..." -ForegroundColor Yellow
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$audit = Join-Path $root ".auditoria\Cardapio\DEPLOY_9AB_$stamp"
New-Item -ItemType Directory -Force -Path $audit | Out-Null
git -C $root bundle create (Join-Path $audit "PRE_DEPLOY_9AB.bundle") HEAD 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "Bundle Git falhou." }
Copy-Item $workerPath   (Join-Path $audit "worker.9AB.js")    -Force
Copy-Item $centralPath  (Join-Path $audit "central.9AB.html") -Force
Copy-Item $themePath    (Join-Path $audit "theme.9AB.json")   -Force
Pass "CHECKPOINT: $audit"

# ── 5/7 Gates estaticos ──────────────────────────────────────────
Write-Host "`n[5/7] Gates estaticos..." -ForegroundColor Yellow
$testsDir = Join-Path $gestao "tests"
foreach ($gate in @("auth-gate-static.cjs","security-gate.cjs","catalog-state-contract.cjs")) {
    $gPath = Join-Path $testsDir $gate
    if (Test-Path $gPath) {
        $psi2 = [System.Diagnostics.ProcessStartInfo]::new()
        $psi2.FileName = "C:\Program Files\nodejs\node.exe"
        $psi2.Arguments = "`"$gPath`""
        $psi2.UseShellExecute = $false
        $psi2.CreateNoWindow  = $false
        $p2 = [System.Diagnostics.Process]::new()
        $p2.StartInfo = $psi2
        $p2.Start() | Out-Null
        $p2.WaitForExit(60000) | Out-Null
        if ($p2.ExitCode -ne 0) { Fail "Gate '$gate' falhou (exit $($p2.ExitCode))." }
        Pass "Gate $gate"
    } else {
        Warn "Gate $gate nao encontrado, ignorando."
    }
}
Pass "GATES CONCLUIDOS"

# ── 6/7 Deploy real ──────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Yellow
Write-Host " [6/7] DEPLOY NO CLOUDFLARE WORKERS..." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Yellow
if ((Run-Wrangler "deploy" 180) -ne 0) { Fail "Deploy falhou." }
Pass "DEPLOY CONCLUIDO"
Write-Host "     Aguardando propagacao (5s)..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# ── 7/7 Smoke test ───────────────────────────────────────────────
Write-Host "`n[7/7] Smoke test pos-deploy..." -ForegroundColor Yellow
try {
    $h = Invoke-RestMethod "$baseUrl/health" -Method GET -TimeoutSec 15
    if ($h.ok -eq $true) { Pass "Health: OK (service=$($h.service))" }
    else                 { Warn  "Health retornou ok=false. Verifique $baseUrl/health" }
} catch { Warn "Health nao respondeu ainda: $_" }
try {
    $r = Invoke-WebRequest "$baseUrl/__auth/login" -Method GET -TimeoutSec 15 -UseBasicParsing
    if ($r.StatusCode -eq 200) { Pass "Login page: HTTP 200" }
    else                       { Warn  "Login page: HTTP $($r.StatusCode)" }
} catch { Warn "Central nao respondeu ainda: $_" }

# ── Conclusao ────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " DEPLOY 9A + 9B CONCLUIDO COM SUCESSO!" -ForegroundColor Green
Write-Host " Central: $baseUrl" -ForegroundColor Green
Write-Host "" -ForegroundColor Green
Write-Host " Proximos passos:" -ForegroundColor Green
Write-Host "  1. Abra a Central > aba [Edicao Visual]" -ForegroundColor Green
Write-Host "  2. Edite um texto > Salvar" -ForegroundColor Green
Write-Host "  3. Visualizar cardapio > confirmar no Preview" -ForegroundColor Green
Write-Host "  4. Publicar alteracoes" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
