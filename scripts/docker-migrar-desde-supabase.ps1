# Copia el esquema kiosco_private de Supabase a la base local de Docker.
# Uso (en PowerShell, desde la carpeta del proyecto, con el stack ya levantado):
#   $env:SUPABASE_DB_URL = Read-Host "Conexion de Supabase (session mode, puerto 5432)"
#   ./scripts/docker-migrar-desde-supabase.ps1
# La conexion se lee de la variable de entorno: no se imprime ni se guarda en disco.

param([string]$EnvFile = ".env.docker")

$ErrorActionPreference = "Stop"

if (-not $env:SUPABASE_DB_URL) { throw "Falta SUPABASE_DB_URL (conexion directa o session pooler, no transaction pooler)." }
if (-not (Test-Path $EnvFile)) { throw "No existe $EnvFile (copiá docker.env.example y completalo)." }

$compose = @("compose", "--env-file", $EnvFile)
$dump = Join-Path $env:TEMP "kiosco_private.dump"

Write-Host "1/3 Respaldando kiosco_private desde Supabase..."
docker run --rm -e SUPABASE_DB_URL -v "${env:TEMP}:/out" postgres:17 `
  sh -c 'pg_dump "$SUPABASE_DB_URL" --schema=kiosco_private --no-owner --no-privileges -Fc -f /out/kiosco_private.dump'
if ($LASTEXITCODE -ne 0) { throw "pg_dump fallo." }

Write-Host "2/3 Frenando la API local para restaurar sin escrituras en curso..."
docker @compose stop api | Out-Null

Write-Host "3/3 Restaurando en la base local (reemplaza lo que haya)..."
docker @compose cp $dump db:/tmp/kiosco_private.dump
docker @compose exec -T db pg_restore -U kiosco -d kiosco --clean --if-exists --no-owner /tmp/kiosco_private.dump
docker @compose exec -T db rm /tmp/kiosco_private.dump

docker @compose start api | Out-Null
Remove-Item $dump -Force
Write-Host "Listo. Verificá con: curl http://localhost:8787/v1/ready"
