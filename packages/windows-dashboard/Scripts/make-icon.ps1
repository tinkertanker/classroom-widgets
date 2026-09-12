# Renders the tray/app icon as a multi-size .ico (PNG-compressed entries).
# Usage: pwsh -File Scripts/make-icon.ps1 [-OutFile Assets/AppIcon.ico]
param(
    [string]$OutFile = (Join-Path $PSScriptRoot '..\Assets\AppIcon.ico')
)

Add-Type -AssemblyName System.Drawing

function New-IconPng([int]$size) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $inset = [Math]::Max(1, [int]($size * 0.04))
    $radius = [Math]::Max(2, [int]($size * 0.22))
    $rect = New-Object System.Drawing.Rectangle $inset, $inset, ($size - 2 * $inset), ($size - 2 * $inset)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 79, 70, 229)), ([System.Drawing.Color]::FromArgb(255, 14, 165, 233)), 45
    $graphics.FillPath($brush, $path)

    # Four "widget tiles" in a 2x2 grid.
    $tileGap = [Math]::Max(1, [int]($size * 0.08))
    $tileSize = [int](($rect.Width - 3 * $tileGap) / 2)
    $tileBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(235, 255, 255, 255))
    $tileRadius = [Math]::Max(1, [int]($tileSize * 0.2))
    foreach ($row in 0..1) {
        foreach ($col in 0..1) {
            $x = $rect.X + $tileGap + $col * ($tileSize + $tileGap)
            $y = $rect.Y + $tileGap + $row * ($tileSize + $tileGap)
            $tile = New-Object System.Drawing.Drawing2D.GraphicsPath
            $td = $tileRadius * 2
            $tile.AddArc($x, $y, $td, $td, 180, 90)
            $tile.AddArc($x + $tileSize - $td, $y, $td, $td, 270, 90)
            $tile.AddArc($x + $tileSize - $td, $y + $tileSize - $td, $td, $td, 0, 90)
            $tile.AddArc($x, $y + $tileSize - $td, $td, $td, 90, 90)
            $tile.CloseFigure()
            $graphics.FillPath($tileBrush, $tile)
        }
    }

    $graphics.Dispose()
    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    return ,$stream.ToArray()
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = @()
foreach ($s in $sizes) {
    [byte[]]$png = New-IconPng $s
    $images += [pscustomobject]@{ Size = $s; Bytes = $png }
}

$out = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter $out
$writer.Write([UInt16]0)          # reserved
$writer.Write([UInt16]1)          # type: icon
$writer.Write([UInt16]$images.Count)
$offset = 6 + 16 * $images.Count
foreach ($entry in $images) {
    $size = $entry.Size; [byte[]]$bytes = $entry.Bytes
    $dim = if ($size -ge 256) { 0 } else { $size }
    $writer.Write([Byte]$dim)      # width
    $writer.Write([Byte]$dim)      # height
    $writer.Write([Byte]0)         # palette
    $writer.Write([Byte]0)         # reserved
    $writer.Write([UInt16]1)       # planes
    $writer.Write([UInt16]32)      # bpp
    $writer.Write([UInt32]$bytes.Length)
    $writer.Write([UInt32]$offset)
    $offset += $bytes.Length
}
foreach ($entry in $images) { [byte[]]$b = $entry.Bytes; $writer.Write($b) }
$writer.Flush()

$dir = Split-Path -Parent $OutFile
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
[System.IO.File]::WriteAllBytes((Resolve-Path -LiteralPath $dir).Path + '\' + (Split-Path -Leaf $OutFile), $out.ToArray())
Write-Host "Wrote $OutFile ($($out.Length) bytes)"
