@echo off
setlocal

set "PROJECT_DIR=%~dp0"
set "NODE_EXE=C:\Users\juanp\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "VITE_JS=%PROJECT_DIR%node_modules\vite\bin\vite.js"
set "CLOUDFLARED_EXE=C:\Users\juanp\Downloads\cloudflared-windows-amd64.exe"

if not exist "%NODE_EXE%" (
  echo No se encontro Node.js en:
  echo %NODE_EXE%
  pause
  exit /b 1
)

if not exist "%VITE_JS%" (
  echo No se encontro Vite. Abri primero el proyecto con el ejecutable de desarrollo.
  pause
  exit /b 1
)

if not exist "%CLOUDFLARED_EXE%" (
  echo No se encontro Cloudflare Tunnel en:
  echo %CLOUDFLARED_EXE%
  pause
  exit /b 1
)

start "KioscoApp - nube local" powershell.exe -WindowStyle Hidden -Command "Set-Location -LiteralPath '%PROJECT_DIR%'; & '%NODE_EXE%' 'server\cloud-server.mjs'"
start "KioscoApp - servidor movil" powershell.exe -NoExit -Command "Set-Location -LiteralPath '%PROJECT_DIR%'; & '%NODE_EXE%' '%VITE_JS%' preview --host 0.0.0.0 --port 4173 --strictPort"
timeout /t 3 /nobreak >nul
start "KioscoApp - enlace para iPhone" powershell.exe -NoExit -Command "& '%CLOUDFLARED_EXE%' tunnel --url http://127.0.0.1:4173 --no-autoupdate"

echo.
echo Se abrieron dos terminales.
echo Copia desde la segunda el enlace https://...trycloudflare.com
echo y abrilo con Safari en el iPhone.
echo.
echo No cierres esas terminales mientras uses la app desde el celular.
pause
