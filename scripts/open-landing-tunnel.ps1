param(
  [Parameter(Mandatory = $true)]
  [string]$CloudflaredPath
)

$landingLinkShown = $false

& $CloudflaredPath tunnel --no-autoupdate --edge-ip-version 4 --url http://127.0.0.1:5173 2>&1 |
  ForEach-Object {
    $line = $_.ToString()
    Write-Host $line

    if (-not $landingLinkShown -and $line -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
      $landingLinkShown = $true
      $landingUrl = "$($Matches[0])/landing.html"
      Write-Host ""
      Write-Host "============================================================" -ForegroundColor Green
      Write-Host "LINK DIRECTO PARA COMPARTIR:" -ForegroundColor Green
      Write-Host $landingUrl -ForegroundColor Cyan
      Write-Host "============================================================" -ForegroundColor Green
      Write-Host ""
    }
  }

exit $LASTEXITCODE
