# Build Android APK with Capacitor-safe asset paths, then publish to public/downloads.
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1

param(
  [string]$Version = "1.10.1",
  [int]$VersionCode = 22,
  [string]$Changelog = "Per-segment attribute forms: fill attributes after each GPS segment (single and dual). End Road 1 switches to Road 2 without a form. Queue for Sync anytime to secure completed segments.",
  [string]$ServerUrl = "https://road-condition-survey.vercel.app"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Mobile = Join-Path $Root "mobile"
$PublicCollector = Join-Path $Root "public\collector"
$MobilePublic = Join-Path $Mobile "public"

Write-Host "Ensuring mobile public assets..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $MobilePublic | Out-Null
Set-Content -Path (Join-Path $Mobile ".env.capacitor") -Value "VITE_DEFAULT_SERVER_URL=$ServerUrl" -Encoding UTF8
Write-Host "  Server URL for APK: $ServerUrl" -ForegroundColor DarkGray
foreach ($name in @("coat_of_arms.png", "zimbabwe_roads.geojson", "favicon.svg")) {
  $src = Join-Path $PublicCollector $name
  if (-not (Test-Path $src)) {
    throw "Missing asset: $src"
  }
  Copy-Item -Force $src (Join-Path $MobilePublic $name)
}

Write-Host "Building Capacitor web bundle..." -ForegroundColor Cyan
Push-Location $Mobile
try {
  npm run build:capacitor
  if ($LASTEXITCODE -ne 0) { throw "Capacitor web build failed" }

  Write-Host "Syncing Capacitor Android project..." -ForegroundColor Cyan
  npx cap sync android
  if ($LASTEXITCODE -ne 0) { throw "cap sync failed" }

  Push-Location (Join-Path $Mobile "android")
  try {
    Write-Host "Assembling debug APK..." -ForegroundColor Cyan
    .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) { throw "Gradle assembleDebug failed" }
  } finally {
    Pop-Location
  }
} finally {
  Pop-Location
}

$publishScript = Join-Path $Root "scripts\publish-apk.ps1"
& $publishScript -Version $Version -VersionCode $VersionCode -Changelog $Changelog -DashboardUrl $ServerUrl

Write-Host ""
Write-Host "APK ready for collectors at /download (v$Version)" -ForegroundColor Green
