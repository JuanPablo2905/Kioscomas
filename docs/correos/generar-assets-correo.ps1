param(
  [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$assetRoot = Join-Path $ProjectRoot "docs/correos/assets"
$publicAssetRoot = Join-Path $ProjectRoot "public/email-assets"
$brandRoot = Join-Path $ProjectRoot "docs/marca/LOGOS canva/files"
New-Item -ItemType Directory -Force -Path $assetRoot | Out-Null
New-Item -ItemType Directory -Force -Path $publicAssetRoot | Out-Null

$petroleo = [System.Drawing.ColorTranslator]::FromHtml("#1C4A44")
$mostaza = [System.Drawing.ColorTranslator]::FromHtml("#E3A23C")
$papel = [System.Drawing.ColorTranslator]::FromHtml("#F6F1E7")
$tinta = [System.Drawing.ColorTranslator]::FromHtml("#2A241E")
$sello = [System.Drawing.ColorTranslator]::FromHtml("#B8412F")

function New-Canvas([int]$Width, [int]$Height, [System.Drawing.Color]$Color) {
  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bitmap.SetResolution(144, 144)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.Clear($Color)
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Draw-FittedImage(
  [System.Drawing.Graphics]$Graphics,
  [System.Drawing.Image]$Image,
  [System.Drawing.RectangleF]$Bounds
) {
  $scale = [Math]::Min($Bounds.Width / $Image.Width, $Bounds.Height / $Image.Height)
  $width = [single]($Image.Width * $scale)
  $height = [single]($Image.Height * $scale)
  $x = [single]($Bounds.X + (($Bounds.Width - $width) / 2))
  $y = [single]($Bounds.Y + (($Bounds.Height - $height) / 2))
  $Graphics.DrawImage($Image, $x, $y, $width, $height)
}

function Draw-Plus(
  [System.Drawing.Graphics]$Graphics,
  [single]$CenterX,
  [single]$CenterY,
  [single]$Size,
  [single]$Thickness,
  [System.Drawing.Color]$Color,
  [single]$Angle = -10
) {
  $state = $Graphics.Save()
  $Graphics.TranslateTransform($CenterX, $CenterY)
  $Graphics.RotateTransform($Angle)
  $brush = New-Object System.Drawing.SolidBrush($Color)
  try {
    $Graphics.FillRectangle($brush, -($Size / 2), -($Thickness / 2), $Size, $Thickness)
    $Graphics.FillRectangle($brush, -($Thickness / 2), -($Size / 2), $Thickness, $Size)
  } finally {
    $brush.Dispose()
    $Graphics.Restore($state)
  }
}

function Save-Png($Canvas, [string]$Path) {
  try {
    $Canvas.Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $Canvas.Graphics.Dispose()
    $Canvas.Bitmap.Dispose()
  }
}

function New-EmailHeader(
  [string]$LogoPath,
  [string]$OutputPath,
  [System.Drawing.Color]$Background,
  [System.Drawing.Color]$AccentA,
  [System.Drawing.Color]$AccentB
) {
  $canvas = New-Canvas 1200 420 $Background
  $g = $canvas.Graphics

  $circleBrushA = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22, $AccentA.R, $AccentA.G, $AccentA.B))
  $circleBrushB = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, $AccentB.R, $AccentB.G, $AccentB.B))
  try {
    $g.FillEllipse($circleBrushA, -150, -250, 520, 520)
    $g.FillEllipse($circleBrushB, 910, 135, 430, 430)
    Draw-Plus $g 1050 94 122 24 ([System.Drawing.Color]::FromArgb(42, $AccentA.R, $AccentA.G, $AccentA.B)) -10
    Draw-Plus $g 126 346 72 14 ([System.Drawing.Color]::FromArgb(28, $AccentB.R, $AccentB.G, $AccentB.B)) -10

    $logo = [System.Drawing.Image]::FromFile($LogoPath)
    try {
      Draw-FittedImage $g $logo ([System.Drawing.RectangleF]::new(150, 62, 900, 296))
    } finally {
      $logo.Dispose()
    }
  } finally {
    $circleBrushA.Dispose()
    $circleBrushB.Dispose()
  }
  Save-Png $canvas $OutputPath
}

function New-EmailBackground([string]$OutputPath) {
  $canvas = New-Canvas 1200 1600 $papel
  $g = $canvas.Graphics

  $petroleoSoft = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(12, $petroleo.R, $petroleo.G, $petroleo.B))
  $mostazaSoft = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(15, $mostaza.R, $mostaza.G, $mostaza.B))
  $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(15, $petroleo.R, $petroleo.G, $petroleo.B), 3)
  try {
    $g.FillEllipse($petroleoSoft, -330, -290, 760, 760)
    $g.FillEllipse($mostazaSoft, 890, 1260, 560, 560)
    $g.DrawEllipse($linePen, 924, -170, 430, 430)
    $g.DrawEllipse($linePen, -210, 1310, 420, 420)
    Draw-Plus $g 1070 250 124 22 ([System.Drawing.Color]::FromArgb(17, $sello.R, $sello.G, $sello.B)) -10
    Draw-Plus $g 126 1350 90 16 ([System.Drawing.Color]::FromArgb(18, $petroleo.R, $petroleo.G, $petroleo.B)) -10
    Draw-Plus $g 1080 1435 68 12 ([System.Drawing.Color]::FromArgb(18, $mostaza.R, $mostaza.G, $mostaza.B)) -10
  } finally {
    $petroleoSoft.Dispose()
    $mostazaSoft.Dispose()
    $linePen.Dispose()
  }
  Save-Png $canvas $OutputPath
}

function Resize-Png([string]$InputPath, [string]$OutputPath, [int]$Width, [int]$Height) {
  $canvas = New-Canvas $Width $Height ([System.Drawing.Color]::Transparent)
  $source = [System.Drawing.Image]::FromFile($InputPath)
  try {
    Draw-FittedImage $canvas.Graphics $source ([System.Drawing.RectangleF]::new(0, 0, $Width, $Height))
  } finally {
    $source.Dispose()
  }
  Save-Png $canvas $OutputPath
}

New-EmailHeader `
  (Join-Path $brandRoot "logo_transparente_claro.png") `
  (Join-Path $assetRoot "cabecera-correo-petroleo-1200x420.png") `
  $petroleo $mostaza $papel

New-EmailHeader `
  (Join-Path $brandRoot "logo_transparente_oscuro.png") `
  (Join-Path $assetRoot "cabecera-correo-papel-1200x420.png") `
  $papel $sello $petroleo

New-EmailBackground (Join-Path $assetRoot "fondo-correo-papel-1200x1600.png")

Resize-Png `
  (Join-Path $brandRoot "mono_petroleo.png") `
  (Join-Path $assetRoot "monograma-correo-320x320.png") `
  320 320

Resize-Png `
  (Join-Path $brandRoot "logo_transparente_claro.png") `
  (Join-Path $assetRoot "logo-correo-claro-1200x375.png") `
  1200 375

Resize-Png `
  (Join-Path $brandRoot "logo_transparente_oscuro.png") `
  (Join-Path $assetRoot "logo-correo-oscuro-1200x375.png") `
  1200 375

Get-ChildItem -LiteralPath $assetRoot -Filter "*.png" -File | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $publicAssetRoot $_.Name) -Force
}

Get-ChildItem -LiteralPath $assetRoot -File | Sort-Object Name | Select-Object Name, Length, LastWriteTime
