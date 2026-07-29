$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$src = Join-Path $root "mobile\dist"
$dest = Join-Path $root "public\collector"

if (-not (Test-Path $src)) {
    throw "Mobile build not found. Run: npm run build --prefix mobile"
}

if (Test-Path $dest) {
    Remove-Item -Recurse -Force $dest
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Recurse -Force (Join-Path $src "*") $dest

Write-Host "Collector web preview copied to public/collector"
Write-Host "Open: http://localhost:3000/collector (or :3001 if 3000 is busy)"
