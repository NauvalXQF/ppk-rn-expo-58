param(
    [ValidateSet("ngrok", "cloudflared", "none")]
    [string]$Tunnel = "none"
)

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$Backend = Join-Path $Root "backend"

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "       PPK - BACKEND STARTUP" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

# 1. Check backend directory

if (!(Test-Path "$Backend\package.json")) {
    throw "Backend package.json tidak ditemukan."
}

# 2. Check required tools

if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    throw "Node.js belum terpasang."
}

if (!(Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
    throw "npm belum tersedia."
}

if ($Tunnel -ne "none") {
    if (!(Get-Command $Tunnel -ErrorAction SilentlyContinue)) {
        throw "$Tunnel belum terpasang atau belum masuk PATH."
    }
}

# 3. Check environment configuration

if (!(Test-Path "$Backend\.env")) {
    throw "Backend .env belum tersedia. Periksa konfigurasi Firebase dan Midtrans."
}

Write-Host "[OK] Backend configuration found" -ForegroundColor Green

# 4. Install dependencies if necessary

if (!(Test-Path "$Backend\node_modules\express\package.json" -PathType Leaf) -or
    !(Test-Path "$Backend\node_modules\firebase-admin\package.json" -PathType Leaf)) {

    Write-Host "[INFO] Installing dependencies..." -ForegroundColor Yellow

    Push-Location $Backend

    try {
        if (!(Test-Path "package-lock.json")) {
            throw "package-lock.json tidak ditemukan. Periksa dependency backend."
        }

        npm.cmd ci

        if ($LASTEXITCODE -ne 0) {
            throw "Dependency installation failed."
        }
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "[OK] Dependencies available" -ForegroundColor Green
}

# 5. Detect backend startup command

$Package = Get-Content -LiteralPath "$Backend\package.json" -Raw | ConvertFrom-Json
if (!$Package.scripts.dev) {
    throw "Script dev backend tidak ditemukan."
}

# Gunakan parser yang sama dan keluarkan hanya host serta port yang tervalidasi.
$ReadConfig = @'
import { parseEnv } from './src/config/env.ts';
try {
    const { host, port } = parseEnv(process.env);
    if (process.argv[2] !== 'none' &&
        (!process.env.MIDTRANS_SERVER_KEY?.trim() || !process.env.MIDTRANS_SIGNATURE_SECRET_KEY?.trim())) {
        throw new Error();
    }
    console.log(JSON.stringify({ host, port }));
} catch {
    process.exitCode = 1;
}
'@

Push-Location -LiteralPath $Backend
try {
    $ConfigJson = $ReadConfig | node --disable-warning=ExperimentalWarning --experimental-strip-types --env-file-if-exists=.env --input-type=module - $Tunnel
    if ($LASTEXITCODE -ne 0) {
        throw "Konfigurasi backend tidak valid. Periksa Firebase, HOST, PORT, dan konfigurasi Midtrans Sandbox untuk tunnel."
    }
    $Config = $ConfigJson | ConvertFrom-Json
}
finally {
    Pop-Location
}

$Port = $Config.port
$ProbeHost = switch ($Config.host) {
    "0.0.0.0" { "127.0.0.1" }
    "::" { "::1" }
    default { $Config.host }
}
if ($ProbeHost.Contains(":")) { $ProbeHost = "[$ProbeHost]" }
$LocalUrl = "http://${ProbeHost}:$Port"

# 6. Check port availability

$Existing = Get-NetTCPConnection `
    -LocalPort $Port `
    -State Listen `
    -ErrorAction SilentlyContinue

if ($Existing) {
    throw "Port $Port sudah digunakan. Periksa backend yang sedang berjalan."
}

# 7. Start backend in a separate terminal

Write-Host "[INFO] Starting backend..." -ForegroundColor Cyan

Start-Process powershell.exe `
    -WorkingDirectory $Backend `
    -ArgumentList "-NoExit", "-Command", "npm.cmd run dev"

# 8. Wait for the backend health endpoint

$Ready = $false

for ($i = 0; $i -lt 30; $i++) {

    try {
        $Health = Invoke-RestMethod -Uri "$LocalUrl/api/health" -TimeoutSec 2
        if ($Health.status -eq "ok") {
            $Ready = $true
            break
        }
    }
    catch {}

    Start-Sleep -Seconds 1
}

if (!$Ready) {
    throw "Health check backend belum berhasil. Periksa terminal backend."
}

Write-Host "[OK] Backend listening on port $Port" -ForegroundColor Green

# 9. Start HTTPS tunnel

if ($Tunnel -eq "ngrok") {

    Write-Host "[INFO] Starting ngrok..." -ForegroundColor Cyan

    Start-Process powershell.exe `
        -ArgumentList "-NoExit", "-Command", "ngrok http $LocalUrl"
}
elseif ($Tunnel -eq "cloudflared") {

    Write-Host "[INFO] Starting Cloudflare Tunnel..." -ForegroundColor Cyan

    Start-Process powershell.exe `
        -ArgumentList "-NoExit", "-Command", "cloudflared tunnel --url $LocalUrl"
}

# 10. Startup summary

Write-Host ""
Write-Host "====================================" -ForegroundColor Green
Write-Host "       BACKEND PORT READY" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""
Write-Host "Local URL : $LocalUrl"
Write-Host "Tunnel    : $Tunnel"
Write-Host ""
if ($Tunnel -ne "none") {
    Write-Host "Check the HTTPS URL in the tunnel terminal."
    Write-Host "Webhook: https://<tunnel-host>/api/payments/webhook"
}
Write-Host ""
Write-Host "Verify backend and frontend configuration."
Write-Host "Then run Expo:"
Write-Host "npx expo start --dev-client" -ForegroundColor Cyan
