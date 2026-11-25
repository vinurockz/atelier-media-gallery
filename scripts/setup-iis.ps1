# Creates the "Atelier" IIS site that reverse-proxies to the Node server on port 4000.
# Run once from an ELEVATED (Run as administrator) PowerShell:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-iis.ps1
# Prereqs: IIS, URL Rewrite and ARR installed (see DEPLOY-IIS.md).
param(
  [int]$Port = 8080,
  [string]$SiteName = "Atelier",
  [string]$SiteDir = "C:\inetpub\atelier"
)
$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw "Run this script from an elevated (Administrator) PowerShell." }

$appcmd = Join-Path $env:windir "System32\inetsrv\appcmd.exe"

# The site folder holds only web.config (the proxy rule). Keeping it outside the user profile
# means the IIS app pool identity can read it without extra folder permissions.
New-Item -ItemType Directory -Force -Path $SiteDir | Out-Null
Copy-Item (Join-Path $PSScriptRoot "..\web.config") $SiteDir -Force

# Enable the ARR proxy (same as ticking "Enable proxy" in IIS Manager).
& $appcmd set config -section:system.webServer/proxy /enabled:"True" /commit:apphost
if ($LASTEXITCODE -ne 0) { throw "Could not enable ARR proxy - is Application Request Routing installed?" }

# Pass responses through as they arrive, so Teams' live updates aren't held back.
& $appcmd set config -section:system.webServer/proxy /responseBufferLimit:"0" /commit:apphost
if ($LASTEXITCODE -ne 0) { throw "Could not turn off ARR response buffering." }

# Replace the site if it already exists, then create it.
& $appcmd list site /name:$SiteName | Out-Null
if ($LASTEXITCODE -eq 0) { & $appcmd delete site $SiteName | Out-Null }
& $appcmd add site /name:$SiteName /bindings:"http/*:${Port}:" /physicalPath:$SiteDir
if ($LASTEXITCODE -ne 0) { throw "Could not create the site (is port $Port already in use?)." }

Write-Host "Done. Make sure 'node server/index.mjs' is running, then open http://localhost:$Port"
