# Packs the macOS app icon (packages/macos-dashboard/Assets/AppIcon.iconset) into a
# multi-size .ico so the Windows app, tray and installer share the same artwork.
# Usage: pwsh -File Scripts/make-icon.ps1 [-OutFile Assets/AppIcon.ico]
param(
    [string]$OutFile = (Join-Path $PSScriptRoot '..\Assets\AppIcon.ico'),
    [string]$IconSet = (Join-Path $PSScriptRoot '..\..\macos-dashboard\Assets\AppIcon.iconset')
)

$ErrorActionPreference = 'Stop'

$sources = @(
    @(16, 'icon_16x16.png'),
    @(32, 'icon_32x32.png'),
    @(64, 'icon_32x32@2x.png'),
    @(128, 'icon_128x128.png'),
    @(256, 'icon_256x256.png')
)

$pngs = @()
foreach ($entry in $sources) {
    $path = Join-Path $IconSet $entry[1]
    if (-not (Test-Path $path)) { continue }
    $pngs += [pscustomobject]@{ Size = $entry[0]; Bytes = [IO.File]::ReadAllBytes($path) }
}
if ($pngs.Count -eq 0) { throw "No iconset PNGs found in $IconSet" }

$stream = New-Object IO.MemoryStream
$writer = New-Object IO.BinaryWriter $stream
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]$pngs.Count)

$offset = 6 + 16 * $pngs.Count
foreach ($png in $pngs) {
    $dim = if ($png.Size -ge 256) { 0 } else { $png.Size }
    $writer.Write([byte]$dim)
    $writer.Write([byte]$dim)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$png.Bytes.Length)
    $writer.Write([uint32]$offset)
    $offset += $png.Bytes.Length
}
foreach ($png in $pngs) { $writer.Write($png.Bytes) }
$writer.Flush()

$OutFile = [IO.Path]::GetFullPath($OutFile)
[IO.File]::WriteAllBytes($OutFile, $stream.ToArray())
Write-Host "Wrote $OutFile ($($pngs.Count) sizes from $IconSet)"
