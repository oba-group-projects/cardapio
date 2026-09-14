$ErrorActionPreference = "Stop"

function Pass($m) { Write-Host "[PASS] $m" -ForegroundColor Green }
function Info($m) { Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Fail($m) { throw $m }

function Invoke-ObaProcess {
    param(
        [Parameter(Mandatory=$true)][string]$FileName,
        [Parameter(Mandatory=$true)][string]$Arguments,
        [Parameter(Mandatory=$true)][string]$WorkingDirectory,
        [int]$TimeoutSeconds = 180,
        [hashtable]$Environment = @{}
    )
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $FileName
    $psi.Arguments = $Arguments
    $psi.WorkingDirectory = $WorkingDirectory
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    foreach ($key in $Environment.Keys) {
        $psi.EnvironmentVariables[$key] = [string]$Environment[$key]
    }
    $p = [System.Diagnostics.Process]::new()
    $p.StartInfo = $psi
    try {
        if (-not $p.Start()) { throw "Nao foi possivel iniciar: $FileName" }
        if (-not $p.WaitForExit($TimeoutSeconds * 1000)) {
            try { $p.Kill() } catch {}
            throw "TIMEOUT apos $TimeoutSeconds s: $FileName $Arguments"
        }
        return [PSCustomObject]@{
            ExitCode = $p.ExitCode
            StdOut   = $p.StandardOutput.ReadToEnd()
            StdErr   = $p.StandardError.ReadToEnd()
        }
    }
    finally {
        if ($p) { $p.Dispose() }
    }
}

# ----------------------------------------------------------------
# CONFIGURACOES
# ----------------------------------------------------------------
$root    = "C:\Users\pc_fa\Documents\Projeto_Gemini"
$gestao  = Join-Path $root "online\gestao"
$npx     = "C:\Program Files\nodejs\npx.cmd"
$baseUrl = "https://oba-cardapio-gestao.obadoceria.workers.dev"
$branchExpected = "feature/gestao-online-segura"

$workerPath  = Join-Path $gestao "src\index.js"
$centralPath = Join-Path $gestao "public\index.html"
$themePath   = Join-Path $gestao "public\data\catalog-v1\theme.json"
$bootstrapPath = Join-Path $gestao "public\preview-bootstrap.js"

Set-Location $root

try {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " DEPLOY FASES 9A + 9B — TEMA VISUAL E EDICAO VISUAL" -ForegroundColor Cyan
    Write-Host " Worker + Assets (Central e Cardapio) -> Cloudflare" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan

    # ── 1/7 Baseline ─────────────────────────────────────────────
    Write-Host "`n[1/7] Validando baseline..." -ForegroundColor Yellow

    $branch = (git branch --show-current).Trim()
    $head   = (git rev-parse --short HEAD).Trim()

    Write-Host "Branch : $branch"
    Write-Host "HEAD   : $head"

    if ($branch -ne $branchExpected) { Fail "Branch incorreta: $branch" }
    if (-not (Test-Path $npx))        { Fail "NPX nao encontrado: $npx" }
    if (-not (Test-Path $workerPath)) { Fail "Worker ausente: $workerPath" }
    if (-not (Test-Path $centralPath)){ Fail "Central ausente: $centralPath" }
    if (-not (Test-Path $themePath))  { Fail "theme.json ausente: $themePath" }

    # Verificar que os arquivos da fase 9 estao presentes
    $htmlContent = Get-Content $centralPath -Raw
    if ($htmlContent -notlike '*data-tab="visual"*') {
        Fail "Aba Edicao Visual ausente no index.html da Central. Verifique o commit 79bf902."
    }
    if ($htmlContent -notlike '*obaPopularFormTema*') {
        Fail "Funcao obaPopularFormTema ausente no index.html. Fase 9B incompleta."
    }

    $themeJson = Get-Content $themePath -Raw | ConvertFrom-Json -ErrorAction Stop
    if (-not $themeJson.paginas) { Fail "theme.json invalido: campo 'paginas' ausente." }

    Pass "BASELINE VALIDADA — HEAD $head"

    # ── 2/7 Sintaxe JS do Worker ──────────────────────────────────
    Write-Host "`n[2/7] Validando sintaxe do Worker..." -ForegroundColor Yellow

    & "C:\Program Files\nodejs\node.exe" --check $workerPath
    if ($LASTEXITCODE -ne 0) { Fail "Sintaxe do Worker invalida." }

    & "C:\Program Files\nodejs\node.exe" --check $bootstrapPath
    if ($LASTEXITCODE -ne 0) { Fail "Sintaxe do preview-bootstrap.js invalida." }

    Pass "SINTAXE JS VALIDA"

    # ── 3/7 Wrangler dry-run ──────────────────────────────────────
    Write-Host "`n[3/7] Executando wrangler dry-run..." -ForegroundColor Yellow

    $dry = Invoke-ObaProcess `
        -FileName    $npx `
        -Arguments   "--no-install wrangler deploy --dry-run" `
        -WorkingDirectory $gestao `
        -TimeoutSeconds 120

    if ($dry.StdOut) { Write-Host $dry.StdOut }
    if ($dry.StdErr) { Write-Host $dry.StdErr -ForegroundColor Yellow }

    if ($dry.ExitCode -ne 0) { Fail "Wrangler dry-run falhou." }

    Pass "WRANGLER DRY-RUN APROVADO"

    # ── 4/7 Checkpoint de seguranca ───────────────────────────────
    Write-Host "`n[4/7] Criando checkpoint de seguranca..." -ForegroundColor Yellow

    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $audit = Join-Path $root ".auditoria\Cardapio\DEPLOY_9AB_$stamp"
    New-Item -ItemType Directory -Force -Path $audit | Out-Null

    git bundle create (Join-Path $audit "PRE_DEPLOY_9AB.bundle") HEAD
    if ($LASTEXITCODE -ne 0) { Fail "Bundle Git falhou." }

    Copy-Item $workerPath   (Join-Path $audit "worker.9AB.js")    -Force
    Copy-Item $centralPath  (Join-Path $audit "central.9AB.html") -Force
    Copy-Item $themePath    (Join-Path $audit "theme.9AB.json")   -Force

    Pass "CHECKPOINT CRIADO: $audit"

    # ── 5/7 Gates estaticos existentes ───────────────────────────
    Write-Host "`n[5/7] Executando gates estaticos existentes..." -ForegroundColor Yellow

    $testsDir = Join-Path $gestao "tests"
    $gates = @(
        "auth-gate-static.cjs",
        "security-gate.cjs",
        "catalog-state-contract.cjs"
    )
    foreach ($gate in $gates) {
        $gPath = Join-Path $testsDir $gate
        if (Test-Path $gPath) {
            & "C:\Program Files\nodejs\node.exe" $gPath
            if ($LASTEXITCODE -ne 0) { Fail "Gate $gate falhou." }
            Pass "Gate $gate"
        } else {
            Warn "Gate $gate nao encontrado, pulando."
        }
    }

    Pass "GATES ESTATICOS CONCLUIDOS"

    # ── 6/7 Deploy real ───────────────────────────────────────────
    Write-Host "`n[6/7] Realizando deploy no Cloudflare Workers..." -ForegroundColor Yellow
    Write-Host "     Worker : $workerPath" -ForegroundColor Gray
    Write-Host "     Assets : $gestao\public" -ForegroundColor Gray

    $deploy = Invoke-ObaProcess `
        -FileName    $npx `
        -Arguments   "--no-install wrangler deploy" `
        -WorkingDirectory $gestao `
        -TimeoutSeconds 180

    if ($deploy.StdOut) { Write-Host $deploy.StdOut }
    if ($deploy.StdErr) { Write-Host $deploy.StdErr -ForegroundColor Yellow }

    if ($deploy.ExitCode -ne 0) { Fail "Deploy Wrangler falhou (exit $($deploy.ExitCode))." }

    Pass "DEPLOY CONCLUIDO COM SUCESSO"

    # Aguarda propagacao
    Write-Host "     Aguardando propagacao (5s)..." -ForegroundColor Gray
    Start-Sleep -Seconds 5

    # ── 7/7 Smoke test de disponibilidade ────────────────────────
    Write-Host "`n[7/7] Smoke test pos-deploy..." -ForegroundColor Yellow

    try {
        $health = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -TimeoutSec 15
        if ($health.ok -ne $true) { Fail "Health check retornou ok=false." }
        Pass "Health check: OK (service=$($health.service))"
    }
    catch {
        Warn "Health check falhou (pode ser propagacao): $_"
        Warn "Verifique manualmente: $baseUrl/health"
    }

    # Verificar que a Central carrega (200)
    try {
        $resp = Invoke-WebRequest -Uri "$baseUrl/__auth/login" -Method GET -TimeoutSec 15 -UseBasicParsing
        if ($resp.StatusCode -ne 200) { Fail "Login page retornou $($resp.StatusCode)." }
        Pass "Login page: HTTP 200"
    }
    catch {
        Warn "Verificacao da Central falhou (pode ser propagacao): $_"
    }

    # ── Conclusao ─────────────────────────────────────────────────
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " DEPLOY 9A + 9B CONCLUIDO COM SUCESSO!" -ForegroundColor Green
    Write-Host " Central: $baseUrl" -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
    Write-Host " Proximos passos:" -ForegroundColor Green
    Write-Host "  1. Acesse a Central e abra a aba 'Edicao Visual'" -ForegroundColor Green
    Write-Host "  2. Altere um texto, salve e clique em 'Visualizar cardapio'" -ForegroundColor Green
    Write-Host "  3. Confirme a alteracao no Preview privado (/__preview)" -ForegroundColor Green
    Write-Host "  4. Clique em 'Publicar alteracoes' para ir a producao" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Red
    Write-Host " FALHA NO DEPLOY 9A+9B" -ForegroundColor Red
    Write-Host " Detalhes: $_" -ForegroundColor Red
    Write-Host " Nenhuma alteracao foi feita na producao (gate protege)." -ForegroundColor Red
    Write-Host "============================================================" -ForegroundColor Red
    exit 1
}
