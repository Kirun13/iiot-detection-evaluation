param([string]$Runtime = (Join-Path $env:LOCALAPPDATA 'AppliedSoft/Jenkins'))
$ErrorActionPreference = 'Stop'
foreach ($name in @('agent', 'controller')) {
    $pidPath = Join-Path $Runtime "$name.pid"
    if (Test-Path -LiteralPath $pidPath) {
        $process = Get-Process -Id ([int](Get-Content $pidPath)) -ErrorAction SilentlyContinue
        if ($process -and $process.ProcessName -eq 'java') { Stop-Process -Id $process.Id }
        Remove-Item -LiteralPath $pidPath
    }
}
Write-Output 'Local Jenkins processes stopped. Configuration and build history retained.'
