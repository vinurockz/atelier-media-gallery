@echo off
rem Starts the Atelier Node server (port 4000). IIS (http://localhost:8080) proxies to it.
rem Keep this window open while the site is in use. Close it to stop the server.
title Atelier server
cd /d "%~dp0"

if not exist dist\index.html (
  echo Building the site first...
  call pnpm build || (echo Build failed. & pause & exit /b 1)
)

echo Starting server on http://localhost:4000 ...
node server\index.mjs
echo.
echo Server stopped.
pause
