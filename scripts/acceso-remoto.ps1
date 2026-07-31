$ErrorActionPreference = "Stop"
$project = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$runtimeNode = "C:\Users\juanp\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$cloudflared = Join-Path $project "tools\cloudflared.exe"
if (-not (Test-Path -LiteralPath $cloudflared)) {
  New-Item -ItemType Directory -Force -Path (Split-Path $cloudflared) | Out-Null
  Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cloudflared
}
Start-Process -FilePath $runtimeNode -ArgumentList @("server/cloud-server.mjs") -WorkingDirectory $project -WindowStyle Hidden
Start-Process -FilePath $runtimeNode -ArgumentList @("node_modules\vite\bin\vite.js", "--host", "127.0.0.1", "--port", "5173") -WorkingDirectory $project -WindowStyle Hidden
Start-Sleep -Seconds 3
& $cloudflared tunnel --url http://127.0.0.1:5173
