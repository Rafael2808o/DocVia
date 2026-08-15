param(
    [string] $WorkspaceRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assetRoot = $PSScriptRoot
$mobileAssets = Join-Path $WorkspaceRoot 'Mobile\DocVia\assets'
$sourceIcon = Join-Path $assetRoot 'icon-candidate.png'
$sourceFeature = Join-Path $assetRoot 'feature-graphic-candidate.png'

function Save-ResizedPng {
    param([System.Drawing.Image] $Source, [int] $Width, [int] $Height, [string] $Destination)
    $bitmap = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($Source, (New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)))
        $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

$icon = [System.Drawing.Bitmap]::FromFile($sourceIcon)
try {
    Save-ResizedPng $icon 1024 1024 (Join-Path $mobileAssets 'icon.png')
    Save-ResizedPng $icon 64 64 (Join-Path $mobileAssets 'favicon.png')
    Save-ResizedPng $icon 512 512 (Join-Path $assetRoot 'play-icon-512.png')

    $foreground = New-Object System.Drawing.Bitmap($icon.Width, $icon.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $monochrome = New-Object System.Drawing.Bitmap($icon.Width, $icon.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        for ($y = 0; $y -lt $icon.Height; $y++) {
            for ($x = 0; $x -lt $icon.Width; $x++) {
                $color = $icon.GetPixel($x, $y)
                $brightness = [Math]::Max($color.R, [Math]::Max($color.G, $color.B))
                $alpha = if ($brightness -le 38) { 0 } elseif ($brightness -ge 70) { 255 } else { [int](255 * ($brightness - 38) / 32) }
                $foreground.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, $color.R, $color.G, $color.B))
                $monochrome.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 255, 255, 255))
            }
        }
        Save-ResizedPng $foreground 1024 1024 (Join-Path $mobileAssets 'android-icon-foreground.png')
        Save-ResizedPng $foreground 1024 1024 (Join-Path $mobileAssets 'splash-icon.png')
        Save-ResizedPng $monochrome 1024 1024 (Join-Path $mobileAssets 'android-icon-monochrome.png')
    } finally {
        $foreground.Dispose()
        $monochrome.Dispose()
    }
} finally {
    $icon.Dispose()
}

$background = New-Object System.Drawing.Bitmap(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$backgroundGraphics = [System.Drawing.Graphics]::FromImage($background)
try {
    $backgroundGraphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#071012'))
    $background.Save((Join-Path $mobileAssets 'android-icon-background.png'), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $backgroundGraphics.Dispose()
    $background.Dispose()
}

if (Test-Path -LiteralPath $sourceFeature) {
    $feature = [System.Drawing.Image]::FromFile($sourceFeature)
    try { Save-ResizedPng $feature 1024 500 (Join-Path $assetRoot 'feature-graphic-1024x500.png') }
    finally { $feature.Dispose() }
}

Write-Output 'Assets do DocVia gerados com sucesso.'
