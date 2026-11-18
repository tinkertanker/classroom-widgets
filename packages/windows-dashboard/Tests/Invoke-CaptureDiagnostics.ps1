param([Parameter(Mandatory = $true)][string]$EvidenceDirectory)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$project = 'packages/windows-dashboard/Tests/ClassroomWidgetsTests'
New-Item -ItemType Directory -Force $EvidenceDirectory | Out-Null
dotnet --info | Out-File (Join-Path $EvidenceDirectory 'dotnet-info.txt')
Get-CimInstance Win32_VideoController |
    Select-Object Name, DriverVersion, VideoModeDescription |
    ConvertTo-Json | Out-File (Join-Path $EvidenceDirectory 'video-controller.json')
[pscustomobject]@{
    userDisableHWAcceleration = (Get-ItemProperty 'HKCU:\SOFTWARE\Microsoft\Avalon.Graphics' -Name DisableHWAcceleration -ErrorAction SilentlyContinue).DisableHWAcceleration
    machineDisableHWAcceleration = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Avalon.Graphics' -Name DisableHWAcceleration -ErrorAction SilentlyContinue).DisableHWAcceleration
} | ConvertTo-Json | Out-File (Join-Path $EvidenceDirectory 'render-settings.json')

dotnet build $project --configuration Release
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$summary = @()
$anyFailure = $false
$originalEvidenceDirectory = $env:CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR
$originalOrder = $env:CLASSROOM_WIDGETS_DIAGNOSTIC_ORDER
$originalControl = $env:CLASSROOM_WIDGETS_DIAGNOSTIC_CONTROL
$originalRenderer = $env:CLASSROOM_WIDGETS_DIAGNOSTIC_RENDERER
try {
    # Reverse the prior experiment's sequence on a fresh VM. Both source types
    # now receive the same per-HWND control; retain all failures, not retries.
    $runs = @(
        @{ name = 'software-before'; renderer = 'software' },
        @{ name = 'default-first'; renderer = 'default' },
        @{ name = 'default-second'; renderer = 'default' },
        @{ name = 'software-after'; renderer = 'software' }
    )
    foreach ($run in $runs) {
        $directory = Join-Path $EvidenceDirectory $run.name
        New-Item -ItemType Directory -Force $directory | Out-Null
        $env:CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR = $directory
        $env:CLASSROOM_WIDGETS_DIAGNOSTIC_ORDER = 'webview-first'
        $env:CLASSROOM_WIDGETS_DIAGNOSTIC_CONTROL = 'baseline'
        $env:CLASSROOM_WIDGETS_DIAGNOSTIC_RENDERER = $run.renderer
        $started = [DateTime]::UtcNow
        Write-Host "::group::Full Windows suite: webview-first / $($run.name)"
        dotnet test $project --configuration Release --no-build --no-restore `
            --logger 'trx;LogFileName=windows.trx' --results-directory $directory
        $code = $LASTEXITCODE
        Write-Host '::endgroup::'
        $seconds = ([DateTime]::UtcNow - $started).TotalSeconds
        if ($code -ne 0) { $anyFailure = $true }

        $trx = Join-Path $directory 'windows.trx'
        $total = 0
        $passed = 0
        $failed = 0
        if (Test-Path $trx) {
            [xml]$results = Get-Content -Raw $trx
            $total = [int]$results.TestRun.ResultSummary.Counters.total
            $passed = [int]$results.TestRun.ResultSummary.Counters.passed
            $failed = [int]$results.TestRun.ResultSummary.Counters.failed
            # Exact-revision inventory: 119 cases, including two existing skips.
            # Fail closed if discovery/orderer failure silently drops tests.
            if ($total -ne 119 -or $failed -ne 0) { $anyFailure = $true }
        } else { $anyFailure = $true }
        $summary += [pscustomobject]@{
            order = 'webview-first'; control = 'baseline'; profile = $run.name; renderer = $run.renderer
            startedUtc = $started.ToString('O'); seconds = $seconds
            exitCode = $code; total = $total; passed = $passed; failed = $failed
        }
        $summary | ConvertTo-Json | Out-File (Join-Path $EvidenceDirectory 'summary.json')
    }
} finally {
    $env:CLASSROOM_WIDGETS_TEST_EVIDENCE_DIR = $originalEvidenceDirectory
    $env:CLASSROOM_WIDGETS_DIAGNOSTIC_ORDER = $originalOrder
    $env:CLASSROOM_WIDGETS_DIAGNOSTIC_CONTROL = $originalControl
    $env:CLASSROOM_WIDGETS_DIAGNOSTIC_RENDERER = $originalRenderer
}
$summary | Format-Table
# Continue collecting controls after a failure, but never turn a later pass into
# a green result for the failed run. Original readiness deadlines, pixel
# tolerances, assertions and skips are unchanged.
if ($anyFailure) { exit 1 }
