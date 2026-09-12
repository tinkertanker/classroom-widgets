# Builds the teacher web app and the native Windows tray app.
#
#   .\script\build_windows.ps1            # Debug build, then launch
#   .\script\build_windows.ps1 -Publish   # Self-contained single-folder release in packages/windows-dashboard/dist
#   .\script\build_windows.ps1 -NoRun     # Build only
[CmdletBinding()]
param(
    [switch]$Publish,
    [switch]$NoRun,
    [switch]$SkipWeb
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$projectDir = Join-Path $repoRoot 'packages\windows-dashboard'
$project = Join-Path $projectDir 'ClassroomWidgets.csproj'

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw 'The .NET 8 SDK is required (https://dotnet.microsoft.com/download/dotnet/8.0).'
}

if (-not $SkipWeb) {
    Push-Location $repoRoot
    try {
        npm run build -w @classroom-widgets/teacher
        if ($LASTEXITCODE -ne 0) { throw 'Teacher web build failed.' }
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path (Join-Path $repoRoot 'packages\teacher\build\index.html'))) {
    throw 'packages/teacher/build/index.html is missing; run the teacher build first.'
}

Get-Process ClassroomWidgets -ErrorAction SilentlyContinue | Stop-Process -Force

if ($Publish) {
    $dist = Join-Path $projectDir 'dist'
    dotnet publish $project -c Release -r win-x64 --self-contained true -o $dist `
        -p:PublishSingleFile=false -p:IncludeNativeLibrariesForSelfExtract=true
    if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed.' }
    Write-Host "Published to $dist"
    $exe = Join-Path $dist 'ClassroomWidgets.exe'
} else {
    dotnet build $project -c Debug -nologo
    if ($LASTEXITCODE -ne 0) { throw 'dotnet build failed.' }
    $exe = Join-Path $projectDir 'bin\Debug\net8.0-windows\ClassroomWidgets.exe'
}

if (-not $NoRun) {
    Start-Process $exe
    Write-Host "Launched $exe (look for the Classroom Widgets icon in the system tray)."
}
