@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "CLOUDFLARED=%~dp0tools\cloudflared.exe"
if exist "%CLOUDFLARED%" goto comprobar

for %%F in ("%USERPROFILE%\Downloads\cloudflared-windows-amd64*.exe") do (
  if exist "%%~fF" set "CLOUDFLARED=%%~fF"
)

if not exist "%CLOUDFLARED%" (
  echo No encontre cloudflared.
  echo Deja cloudflared-windows-amd64.exe en la carpeta Descargas y volve a abrir este archivo.
  pause
  exit /b 1
)

:comprobar
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/landing.html' -TimeoutSec 3; if ($r.StatusCode -eq 200) { exit 0 } } catch {}; exit 1"
if errorlevel 1 (
  echo.
  echo La landing todavia no esta funcionando.
  echo Primero abri KioscoPlus-Desarrollo.exe y deja la aplicacion encendida.
  echo Despues volve a abrir este archivo.
  pause
  exit /b 1
)

echo.
echo ============================================================
echo Creando enlace publico temporal para la landing de Kiosco+...
echo ============================================================
echo.
echo El enlace directo para compartir aparecera resaltado abajo.
echo Esta computadora, Kiosco+ y esta ventana deben quedar abiertos.
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-landing-tunnel.ps1" -CloudflaredPath "%CLOUDFLARED%"

echo.
echo El tunel se cerro y el enlace ya no funciona.
pause
