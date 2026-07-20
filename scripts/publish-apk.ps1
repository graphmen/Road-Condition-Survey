# Publish a built Android APK to the web download page.
#
# Usage (from repo root):
#   powershell -ExecutionPolicy Bypass -File scripts/publish-apk.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/publish-apk.ps1 -ApkPath "path\to\app-release.apk" -Version "1.1"
#
# Default source: mobile/android/app/build/outputs/apk/debug/app-debug.apk

param(
  [string]$ApkPath = "",
  [string]$Version = "1.0",
  [int]$VersionCode = 1,
  [string]$Changelog = "Field collector release for MOTID road condition surveys."
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$DestDir = Join-Path $Root "public\downloads"
$DestApk = Join-Path $DestDir "motid-road-survey.apk"
$InfoPath = Join-Path $DestDir "app-info.json"

if (-not $ApkPath) {
  $candidates = @(
    (Join-Path $Root "mobile\android\app\build\outputs\apk\release\app-release.apk"),
    (Join-Path $Root "mobile\android\app\build\outputs\apk\debug\app-debug.apk")
  )
  foreach ($c in $candidates) {
    if (Test-Path $c) {
      $ApkPath = $c
      break
    }
  }
}

if (-not $ApkPath -or -not (Test-Path $ApkPath)) {
  Write-Host "APK not found." -ForegroundColor Red
  Write-Host ""
  Write-Host "Build one first:"
  Write-Host "  cd mobile"
  Write-Host "  npm run build"
  Write-Host "  npx cap sync"
  Write-Host "  cd android"
  Write-Host "  .\gradlew.bat assembleDebug"
  Write-Host ""
  Write-Host "Or pass -ApkPath to an existing .apk file."
  exit 1
}

New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
Copy-Item -Path $ApkPath -Destination $DestApk -Force

$size = (Get-Item $DestApk).Length
$releasedAt = (Get-Date).ToUniversalTime().ToString("o")

$info = @{
  appName      = "MOTID Road Survey"
  packageId    = "zw.gov.motid.roadsurvey"
  versionName  = $Version
  versionCode  = $VersionCode
  fileName     = "motid-road-survey.apk"
  minAndroid   = "7.0 (API 24)"
  releasedAt   = $releasedAt
  sizeBytes    = $size
  available    = $true
  changelog    = $Changelog
} | ConvertTo-Json

Set-Content -Path $InfoPath -Value $info -Encoding UTF8

Write-Host ""
Write-Host "Published APK for download page" -ForegroundColor Green
Write-Host "  Source : $ApkPath"
Write-Host "  Dest   : $DestApk"
Write-Host "  Size   : $([math]::Round($size / 1MB, 1)) MB"
Write-Host "  Version: $Version"
Write-Host ""
Write-Host "Local test URL: http://localhost:3000/download"
Write-Host "After deploy, send collectors: https://<your-domain>/download"
