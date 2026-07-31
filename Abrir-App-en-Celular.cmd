@echo off
title KioscoApp - Acceso desde celular
cd /d "C:\Users\juanp\OneDrive\Escritorio\kiosco app"
echo.
echo KioscoApp estara disponible mientras esta ventana permanezca abierta.
echo.
echo Desde un celular conectado al mismo Wi-Fi, abrir:
echo http://192.168.0.251:8080
echo.
echo Si Windows pregunta por el firewall, permitir Redes privadas.
echo Para detener el acceso, cerrar esta ventana.
echo.
start "Kiosco Cloud local" /min cmd /c ""C:\Users\juanp\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "server\cloud-server.mjs""
"C:\Users\juanp\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "node_modules\vite\bin\vite.js" preview --host 0.0.0.0 --port 8080 --strictPort
pause
