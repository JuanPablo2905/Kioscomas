param()

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectRoot "desktop\icon.png"
$outputDirectory = Join-Path $projectRoot "build\appx"

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "No se encontró el ícono principal en $sourcePath"
}

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$source = [System.Drawing.Image]::FromFile($sourcePath)

function New-KioscoAsset {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][int]$Width,
    [Parameter(Mandatory = $true)][int]$Height,
    [double]$LogoScale = 1.0,
    [switch]$Transparent
  )

  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  if ($Transparent) {
    $graphics.Clear([System.Drawing.Color]::Transparent)
  } else {
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#F6F1E7"))
  }

  $logoSize = [Math]::Max(1, [Math]::Round([Math]::Min($Width, $Height) * $LogoScale))
  $left = [Math]::Round(($Width - $logoSize) / 2)
  $top = [Math]::Round(($Height - $logoSize) / 2)
  $graphics.DrawImage($source, $left, $top, $logoSize, $logoSize)

  $targetPath = Join-Path $outputDirectory $Name
  $bitmap.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

try {
  New-KioscoAsset -Name "StoreLogo.png" -Width 50 -Height 50 -LogoScale 0.88 -Transparent
  New-KioscoAsset -Name "Square44x44Logo.png" -Width 44 -Height 44 -LogoScale 0.86 -Transparent
  New-KioscoAsset -Name "Square150x150Logo.png" -Width 150 -Height 150 -LogoScale 0.82 -Transparent
  New-KioscoAsset -Name "Wide310x150Logo.png" -Width 310 -Height 150 -LogoScale 0.72
  New-KioscoAsset -Name "LargeTile.png" -Width 310 -Height 310 -LogoScale 0.62
  New-KioscoAsset -Name "SmallTile.png" -Width 71 -Height 71 -LogoScale 0.78 -Transparent
  New-KioscoAsset -Name "SplashScreen.png" -Width 620 -Height 300 -LogoScale 0.58
} finally {
  $source.Dispose()
}

Write-Host "Recursos de Microsoft Store generados en $outputDirectory"
