# Respaldo de la base de Kiosco+ que corre en Docker. Valida el archivo y borra los viejos.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/docker-respaldo.ps1
# Los respaldos contienen datos reales del negocio: guardalos en una carpeta privada,
# no en una carpeta sincronizada con la nube pública.

param(
  [string]$Dest = (Join-Path $env:USERPROFILE "kioscomas-respaldos"),
  [int]$KeepDays = 14,
  [string]$EnvFile = ".env.docker"
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path $EnvFile)) { throw "No existe $EnvFile." }
New-Item -ItemType Directory -Force -Path $Dest | Out-Null

$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$name = "kiosco_$stamp.dump"
$compose = @("compose", "--env-file", $EnvFile)

docker @compose exec -T db pg_dump -U kiosco -d kiosco -Fc -f "/tmp/$name"
if ($LASTEXITCODE -ne 0) { throw "pg_dump fallo." }

docker @compose exec -T db pg_restore --list "/tmp/$name" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "El respaldo generado no es valido." }

docker @compose cp "db:/tmp/$name" (Join-Path $Dest $name)
if ($LASTEXITCODE -ne 0) { throw "No se pudo copiar el respaldo al disco." }
docker @compose exec -T db rm "/tmp/$name" | Out-Null

Get-ChildItem $Dest -Filter "kiosco_*.dump" |
  Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
  Remove-Item -Force

$size = [math]::Round((Get-Item (Join-Path $Dest $name)).Length / 1MB, 2)
Write-Host "Respaldo listo: $(Join-Path $Dest $name) ($size MB)"
