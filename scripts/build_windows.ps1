# Builds the teacher web app and the native Windows tray app.
#
#   .\scripts\build_windows.ps1            # Debug build, then launch
#   .\scripts\build_windows.ps1 -Publish   # Self-contained single-folder release in packages/windows-dashboard/dist
#   .\scripts\build_windows.ps1 -NoRun     # Build only
[CmdletBinding()]
param(
    [switch]$Publish,
    [switch]$NoRun,
    [switch]$Installer,
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
        pnpm --filter @classroom-widgets/teacher build
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
    if ($Installer) {
        $iscc = Join-Path ${env:ProgramFiles(x86)} 'Inno Setup 6\ISCC.exe'
        if (-not (Test-Path $iscc)) { throw 'Inno Setup 6 is required for -Installer (https://jrsoftware.org/isinfo.php).' }
        $version = (Get-Content (Join-Path $repoRoot 'version.json') | ConvertFrom-Json).version
        & $iscc "/DAppVersion=$version" '/DSourceDir=..\dist' '/DOutputDir=..\dist-installer' (Join-Path $projectDir 'Installer\ClassroomWidgets.iss')
        if ($LASTEXITCODE -ne 0) { throw 'Inno Setup build failed.' }
        Write-Host "Installer written to $(Join-Path $projectDir 'dist-installer')"
    }
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
