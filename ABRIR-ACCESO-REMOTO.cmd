@echo off
cd /d "%~dp0"
start "Kiosco Cloud local" /min cmd /c ""C:\Users\juanp\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "server\cloud-server.mjs""
start "KioscoApp remoto" /min cmd /c ""C:\Users\juanp\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "node_modules\vite\bin\vite.js" --host 0.0.0.0 --port 5173 > acceso-remoto.log 2>&1"
timeout /t 3 /nobreak >nul
echo.
echo KioscoApp esta disponible mediante Tailscale.
echo Para usarla desde el iPhone abri la direccion HTTPS que muestra
echo el archivo CONFIGURAR-TAILSCALE-HTTPS.cmd.
echo No uses la direccion http://100.81.235.105 porque Safari bloquea
echo las funciones seguras de KioscoApp.
echo.
echo La computadora debe quedar encendida, con Tailscale conectado
echo y esta ventana de acceso remoto iniciada.
echo.
pause
