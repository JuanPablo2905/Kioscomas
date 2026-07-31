@echo off
cd /d "%~dp0"
start "Kiosco Cloud local" /min cmd /c ""C:\Users\juanp\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "server\cloud-server.mjs""
timeout /t 2 /nobreak >nul
start "KioscoApp local" cmd /c ""C:\Users\juanp\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "node_modules\vite\bin\vite.js" --host 0.0.0.0 --port 5173"
echo Servidor: http://127.0.0.1:8787
echo App: http://127.0.0.1:5173
echo En Configurar - Nube usa http://127.0.0.1:8787
pause
