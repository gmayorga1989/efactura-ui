# Publica el build de producción en el Droplet (/opt/efactura-ui/html).
# Uso (desde frontend/efactura-ui):
#   .\deploy\publish-dist.ps1
#   .\deploy\publish-dist.ps1 -SkipBuild

param(
    [string]$IP = "159.89.41.88",
    [string]$User = "root",
    [string]$SshKey = "$env:USERPROFILE\.ssh\id_ed25519.pem",
    [int]$Port = 22,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$AppRoot = Split-Path $PSScriptRoot -Parent
$DistBrowser = Join-Path $AppRoot "dist\efactura-ec\browser"
$RemoteOpt = "/opt/efactura-ui"
$TarName = "efactura-ui-dist.tar.gz"

Push-Location $AppRoot
try {
    if (-not $SkipBuild) {
        Write-Host ">> npm ci && ng build (production)..." -ForegroundColor Cyan
        npm ci
        npm run build -- --configuration production
    }

    if (-not (Test-Path $DistBrowser)) {
        throw "No existe $DistBrowser — ejecuta el build antes."
    }

    $TarPath = Join-Path $AppRoot $TarName
    if (Test-Path $TarPath) { Remove-Item $TarPath -Force }

    Write-Host ">> Empaquetando dist..." -ForegroundColor Cyan
    tar -czf $TarName -C $DistBrowser .

    $ScpBase = @("-i", $SshKey, "-P", $Port)
    if ($Port -eq 22) { $ScpBase = @("-i", $SshKey) }

    Write-Host ">> Subiendo nginx.conf.example..." -ForegroundColor Cyan
    scp @ScpBase `
        (Join-Path $AppRoot "deploy\nginx-efactura-ui.conf.example") `
        "${User}@${IP}:${RemoteOpt}/nginx.conf.example"

    Write-Host ">> Subiendo $TarName..." -ForegroundColor Cyan
    scp @ScpBase $TarPath "${User}@${IP}:${RemoteOpt}/"

    Write-Host ">> Extrayendo en servidor..." -ForegroundColor Cyan
    $RemoteScript = @"
set -euo pipefail
mkdir -p ${RemoteOpt}/html
rm -rf ${RemoteOpt}/html/*
tar -xzf ${RemoteOpt}/${TarName} -C ${RemoteOpt}/html
rm -f ${RemoteOpt}/${TarName}
echo OK: ${RemoteOpt}/html
ls -la ${RemoteOpt}/html | head -5
sudo nginx -t && sudo systemctl reload nginx
"@ -replace "`r`n", "`n"

    ssh -i $SshKey "${User}@${IP}" $RemoteScript

    Write-Host ">> eFactura UI publicado en ${RemoteOpt}/html" -ForegroundColor Green
}
finally {
    Pop-Location
}
