# Build Android APK with Capacitor-safe asset paths, then publish to public/downloads.
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1

param(
  [string]$Version = "1.6.6",
  [int]$VersionCode = 13,
  [string]$Changelog = "Sealed road dual collection: collect Road 1 and Road 2 sequentially on parallel carriageways."
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Mobile = Join-Path $Root "mobile"
$PublicCollector = Join-Path $Root "public\collector"
$MobilePublic = Join-Path $Mobile "public"

Write-Host "Ensuring mobile public assets..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $MobilePublic | Out-Null
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
& $publishScript -Version $Version -VersionCode $VersionCode -Changelog $Changelog

Write-Host ""
Write-Host "APK ready for collectors at /download (v$Version)" -ForegroundColor Green
