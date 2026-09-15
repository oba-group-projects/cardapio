#Requires -Version 5.1
# CONFIGURAR GITHUB_PAT NO CLOUDFLARE WORKER — FASE 9D
# Uso: duplo-clique em EXECUTAR-9D-CONFIGURAR-PAT.cmd

$ErrorActionPreference = "Continue"
Set-StrictMode -Off

$root    = "C:\Users\pc_fa\Documents\Projeto_Gemini"
$gestao  = Join-Path $root "online\gestao"
$wrangler = Join-Path $gestao "node_modules\.bin\wrangler.cmd"

Set-Location $root

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " FASE 9D — CONFIGURAR GITHUB_PAT NO CLOUDFLARE WORKER" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Este script configura o Personal Access Token do GitHub" -ForegroundColor White
Write-Host "como secret no Worker, sem que o token seja gravado em" -ForegroundColor White
Write-Host "nenhum arquivo ou historico do Git." -ForegroundColor White
Write-Host ""
Write-Host "Pre-requisito: criar o PAT em" -ForegroundColor Yellow
Write-Host "  https://github.com/settings/personal-access-tokens/new" -ForegroundColor Yellow
Write-Host ""
Write-Host "Configuracoes necessarias no GitHub:" -ForegroundColor Yellow
Write-Host "  - Token name: oba-cardapio-sync" -ForegroundColor White
Write-Host "  - Repository access: Only select -> oba-group-projects/cardapio" -ForegroundColor White
Write-Host "  - Permissions -> Contents: Read and write" -ForegroundColor White
Write-Host "  - Todo o resto: No access" -ForegroundColor White
Write-Host ""

if (-not (Test-Path $wrangler)) {
    Write-Host "ERRO: wrangler.cmd nao encontrado em: $wrangler" -ForegroundColor Red
    Write-Host "Execute 'npm install' na pasta online/gestao primeiro." -ForegroundColor Yellow
    exit 1
}

# Solicita o PAT de forma segura (nao aparece na tela)
Write-Host "Cole o token abaixo e pressione Enter:" -ForegroundColor Cyan
Write-Host "(o token nao sera exibido nem salvo em arquivo)" -ForegroundColor Gray
$securePat = Read-Host -AsSecureString "GitHub PAT"

# Converte para string em memoria
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePat)
$patValue = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)

if ([string]::IsNullOrWhiteSpace($patValue)) {
    Write-Host "ERRO: Token vazio. Operacao cancelada." -ForegroundColor Red
    exit 1
}

if (-not ($patValue -match '^github_pat_[A-Za-z0-9_]+$|^ghp_[A-Za-z0-9]+$')) {
    Write-Host "AVISO: O token nao parece estar no formato esperado do GitHub." -ForegroundColor Yellow
    Write-Host "       Formatos aceitos: github_pat_... ou ghp_..." -ForegroundColor Yellow
    $confirmar = Read-Host "Continuar mesmo assim? (s/n)"
    if ($confirmar -ne 's') { exit 1 }
}

Write-Host ""
Write-Host "Configurando GITHUB_PAT no Worker..." -ForegroundColor Yellow

# Usa wrangler secret put via stdin para evitar que o token apareça nos argumentos
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

# Envia o token via stdin
$p.StandardInput.WriteLine($patValue)
$p.StandardInput.Close()

# Limpa o token da memória imediatamente
$patValue = $null
[GC]::Collect()

$p.WaitForExit(60000) | Out-Null

if ($p.ExitCode -eq 0) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host " GITHUB_PAT CONFIGURADO COM SUCESSO!" -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
    Write-Host " O Worker agora sincronizara automaticamente o cardapio" -ForegroundColor Green
    Write-Host " publico no GitHub Pages a cada publicacao na Central." -ForegroundColor Green
    Write-Host "" -ForegroundColor Green
    Write-Host " Para verificar: publique uma alteracao na Central e" -ForegroundColor Green
    Write-Host " aguarde ~1 minuto para o GitHub Pages reconstruir." -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "ERRO: Falha ao configurar o secret (exit $($p.ExitCode))." -ForegroundColor Red
    Write-Host "Verifique se o wrangler esta autenticado (wrangler whoami)." -ForegroundColor Yellow
    exit 1
}
