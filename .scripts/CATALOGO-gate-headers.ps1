#!/usr/bin/env pwsh
# CATALOGO-gate-headers.ps1
# Testa os headers HTTP das rotas públicas do Catálogo.
# Regressão para: CSP ausente no /catalogo causava falha em smartphones Android.
# Commit de correção: fix(catalogo): CSP na rota /catalogo igual ao /cardapio

param(
    [string]$BaseUrl = "https://oba-cardapio-gestao.obadoceria.workers.dev"
)

$erros = 0

function Pass { param([string]$msg) Write-Host "[PASS] $msg" -ForegroundColor Green }
function Fail { param([string]$msg) Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:erros++ }
function Info { param([string]$msg) Write-Host "  --> $msg" -ForegroundColor Gray }

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " CATÁLOGO — Gate de Headers HTTP" -ForegroundColor Cyan
Write-Host " Base: $BaseUrl" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# ── TESTE 1: /catalogo responde 200 ──────────────────────────────────────────
Write-Host "T1: /catalogo — HTTP 200"
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/catalogo" -UseBasicParsing -TimeoutSec 20
    if ($r.StatusCode -eq 200) { Pass "HTTP 200" }
    else { Fail "Esperado 200, recebido $($r.StatusCode)" }
} catch { Fail "Request falhou: $_" }

# ── TESTE 2: /catalogo tem Content-Security-Policy ───────────────────────────
Write-Host "T2: /catalogo — Content-Security-Policy presente"
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/catalogo" -UseBasicParsing -TimeoutSec 20
    $csp = $r.Headers["Content-Security-Policy"]
    if ($csp) {
        Pass "CSP presente"
        Info $csp
    } else {
        Fail "CSP ausente — smartphones Android podem bloquear fetch"
    }
} catch { Fail "Request falhou: $_" }

# ── TESTE 3: CSP permite connect-src self https ───────────────────────────────
Write-Host "T3: /catalogo — CSP contém connect-src 'self' https:"
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/catalogo" -UseBasicParsing -TimeoutSec 20
    $csp = $r.Headers["Content-Security-Policy"]
    if ($csp -and ($csp -match "connect-src.*'self'.*https:")) {
        Pass "connect-src correto"
    } else {
        Fail "connect-src ausente ou incompleto — /api/catalog pode ser bloqueado"
        Info "CSP atual: $csp"
    }
} catch { Fail "Request falhou: $_" }

# ── TESTE 4: /cardapio também responde 200 (regressão) ───────────────────────
Write-Host "T4: /cardapio — HTTP 200 (regressão)"
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/cardapio" -UseBasicParsing -TimeoutSec 20
    if ($r.StatusCode -eq 200) { Pass "HTTP 200" }
    else { Fail "Esperado 200, recebido $($r.StatusCode)" }
} catch { Fail "Request falhou: $_" }

# ── TESTE 5: /api/catalog responde ok:true ────────────────────────────────────
Write-Host "T5: /api/catalog — ok:true"
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/api/catalog" -UseBasicParsing -TimeoutSec 20
    if ($r.Content -match '"ok"\s*:\s*true') { Pass "ok:true" }
    else { Fail "ok:true ausente na resposta" }
} catch { Fail "Request falhou: $_" }

# ── TESTE 6: /catalogo contém published-bootstrap.js ─────────────────────────
Write-Host "T6: /catalogo — published-bootstrap.js injetado"
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/catalogo" -UseBasicParsing -TimeoutSec 20
    if ($r.Content -match "published-bootstrap\.js") { Pass "bootstrap injetado" }
    else { Fail "published-bootstrap.js ausente no HTML" }
} catch { Fail "Request falhou: $_" }

# ── TESTE 7: /api/catalog contém grupos_ordem com campo imagem ───────────────
Write-Host "T7: /api/catalog — grupos_ordem contém campo imagem"
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/api/catalog" -UseBasicParsing -TimeoutSec 20
    if ($r.Content -match '"grupos_ordem"' -and $r.Content -match '"imagem"') {
        Pass "grupos_ordem e imagem presentes"
    } else {
        Fail "grupos_ordem ou imagem ausentes — sync do D1 pode estar desatualizado"
    }
} catch { Fail "Request falhou: $_" }

# ── TESTE 8: /published-bootstrap.js acessível sem autenticação ──────────────
Write-Host "T8: /published-bootstrap.js — HTTP 200 sem autenticação (causa raiz do bug)"
try {
    $r = Invoke-WebRequest -Uri "$BaseUrl/published-bootstrap.js" -UseBasicParsing -TimeoutSec 20
    if ($r.StatusCode -eq 200) {
        if ($r.Content -match "nativeFetch" -and $r.Content -match "publishedPromise") {
            Pass "HTTP 200 — bootstrap acessível sem auth, conteúdo válido"
        } else {
            Fail "HTTP 200 mas conteúdo inesperado (nativeFetch ou publishedPromise ausente)"
        }
    } else {
        Fail "Esperado 200, recebido $($r.StatusCode) — bootstrap bloqueado para anônimos"
    }
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Fail "Request falhou (código $code): $_ — bootstrap bloqueado para anônimos"
}

# ── RESULTADO ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
if ($erros -eq 0) {
    Write-Host " RESULTADO: TODOS OS TESTES PASSARAM ($erros erros)" -ForegroundColor Green
} else {
    Write-Host " RESULTADO: $erros TESTE(S) FALHARAM" -ForegroundColor Red
}
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

exit $erros
