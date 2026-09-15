#Requires -Version 5.1
# CONFIGURAR GITHUB_PAT NO CLOUDFLARE WORKER - FASE 9D
# Uso: duplo-clique em EXECUTAR-9D-CONFIGURAR-PAT.cmd

$ErrorActionPreference = "Continue"
Set-StrictMode -Off

$root     = "C:\Users\pc_fa\Documents\Projeto_Gemini"
$gestao   = Join-Path $root "online\gestao"
$wrangler = Join-Path $gestao "node_modules\.bin\wrangler.cmd"

Set-Location $root

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FASE 9D - CONFIGURAR GITHUB_PAT NO CLOUDFLARE WORKER" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este script configura o Personal Access Token do GitHub" -ForegroundColor White
Write-Host "como secret no Worker, sem gravar o token em nenhum arquivo." -ForegroundColor White
Write-Host ""

if (-not (Test-Path $wrangler)) {
    Write-Host "ERRO: wrangler.cmd nao encontrado: $wrangler" -ForegroundColor Red
    exit 1
}

Write-Host "Cole o token abaixo e pressione Enter:" -ForegroundColor Cyan
Write-Host "(o token nao sera exibido na tela)" -ForegroundColor Gray
$securePat = Read-Host -AsSecureString "GitHub PAT"

$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePat)
$patValue = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if ([string]::IsNullOrWhiteSpace($patValue)) {
    Write-Host "ERRO: Token vazio. Operacao cancelada." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Configurando GITHUB_PAT no Worker..." -ForegroundColor Yellow

$psi = [System.Diagnostics.ProcessStartInfo]::new()
$psi.FileName = $wrangler
$psi.Arguments = "secret put GITHUB_PAT"
$psi.WorkingDirectory = $gestao
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $false
$psi.RedirectStandardInput = $true

$p = [System.Diagnostics.Process]::new()
$p.StartInfo = $psi
$p.Start() | Out-Null

$p.StandardInput.WriteLine($patValue)
$p.StandardInput.Close()

$patValue = $null
[GC]::Collect()

$p.WaitForExit(60000) | Out-Null

if ($p.ExitCode -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " GITHUB_PAT CONFIGURADO COM SUCESSO!" -ForegroundColor Green
    Write-Host " O Worker vai sincronizar o cardapio publico a cada publicacao." -ForegroundColor Green
    Write-Host " Teste: publique algo na Central e aguarde ~1 minuto." -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ERRO: Falha (exit $($p.ExitCode))." -ForegroundColor Red
    Write-Host "Verifique se o wrangler esta autenticado com: wrangler whoami" -ForegroundColor Yellow
    exit 1
}
