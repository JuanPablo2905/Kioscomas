@echo off
title Configurar acceso HTTPS de KioscoApp
echo.
echo Configurando KioscoApp dentro de tu red privada de Tailscale...
echo.
"C:\Program Files\Tailscale\tailscale.exe" serve --bg --https=443 5173
if errorlevel 1 goto error
"C:\Program Files\Tailscale\tailscale.exe" serve --bg --https=8443 8787
if errorlevel 1 goto error
echo.
echo Listo. Tailscale mostrara arriba la direccion HTTPS de KioscoApp.
echo Copia esa direccion y abrila desde el iPhone.
echo.
pause
exit /b 0

:error
echo.
echo No se pudo completar la configuracion.
echo Hace clic derecho sobre este archivo y elegi "Ejecutar como administrador".
echo Si Tailscale muestra un enlace para habilitar HTTPS, abrilo y aceptalo.
echo.
pause
exit /b 1
