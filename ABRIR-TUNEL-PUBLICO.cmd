@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "CLOUDFLARED=%~dp0tools\cloudflared.exe"
if exist "%CLOUDFLARED%" goto iniciar

for %%F in ("%USERPROFILE%\Downloads\cloudflared-windows-amd64*.exe") do (
  if exist "%%~fF" set "CLOUDFLARED=%%~fF"
)

if not exist "%CLOUDFLARED%" (
  echo No encontre cloudflared en la carpeta Descargas.
  echo Descarga el ejecutable Windows 64-bit desde:
  echo https://developers.cloudflare.com/tunnel/downloads/
  echo Dejalo en Descargas y volve a abrir este archivo.
  pause
  exit /b 1
)

:iniciar
echo Creando enlace publico temporal para KioscoApp...
echo La computadora y esta ventana deben permanecer encendidas.
echo.
"%CLOUDFLARED%" tunnel --no-autoupdate --edge-ip-version 4 --url http://127.0.0.1:5173
echo.
echo El tunel se cerro. El enlace publico ya no funciona.
pause
