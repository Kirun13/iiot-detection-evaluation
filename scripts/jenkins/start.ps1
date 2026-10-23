param([string]$Runtime = (Join-Path $env:LOCALAPPDATA 'AppliedSoft/Jenkins'))
$ErrorActionPreference = 'Stop'
$java = (Get-Command java).Source
$env:JENKINS_HOME = Join-Path $Runtime 'home'
$env:APPLIED_SOFT_JENKINS_RUNTIME = $Runtime
$pidFile = Join-Path $Runtime 'controller.pid'
$running = $false
if (Test-Path -LiteralPath $pidFile) {
    $running = $null -ne (Get-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue)
}
if (!$running) {
    $controller = Start-Process -FilePath $java -ArgumentList @('-Xmx768m', '-Djenkins.install.runSetupWizard=false', '-jar', "`"$(Join-Path $Runtime 'jenkins.war')`"", '--httpListenAddress=127.0.0.1', '--httpPort=8080') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $Runtime 'controller.out.log') -RedirectStandardError (Join-Path $Runtime 'controller.err.log')
    [IO.File]::WriteAllText($pidFile, [string]$controller.Id)
}
$ready = $false
for ($attempt = 0; $attempt -lt 120; $attempt++) {
    try {
        $response = Invoke-WebRequest 'http://127.0.0.1:8080/login' -UseBasicParsing -TimeoutSec 2
        if ($response.StatusCode -eq 200 -and (Test-Path -LiteralPath (Join-Path $Runtime 'secrets/agent-secret.txt'))) { $ready = $true; break }
    } catch { }
    Start-Sleep -Seconds 2
}
if (!$ready) { throw 'Jenkins did not become ready. Inspect controller.err.log.' }
$agentJar = Join-Path $Runtime 'agent.jar'
Invoke-WebRequest 'http://127.0.0.1:8080/jnlpJars/agent.jar' -OutFile $agentJar -UseBasicParsing
$agentPid = Join-Path $Runtime 'agent.pid'
$agentRunning = $false
if (Test-Path -LiteralPath $agentPid) {
    $agentRunning = $null -ne (Get-Process -Id ([int](Get-Content $agentPid)) -ErrorAction SilentlyContinue)
}
if (!$agentRunning) {
    $agent = Start-Process -FilePath $java -ArgumentList @('-Xmx512m', '-jar', "`"$agentJar`"", '-url', 'http://127.0.0.1:8080/', '-secret', "`"@$(Join-Path $Runtime 'secrets/agent-secret.txt')`"", '-name', 'windows-docker', '-webSocket', '-workDir', "`"$(Join-Path $env:USERPROFILE 'AppliedSoftJenkinsAgent')`"") -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $Runtime 'agent.out.log') -RedirectStandardError (Join-Path $Runtime 'agent.err.log')
    [IO.File]::WriteAllText($agentPid, [string]$agent.Id)
}
Write-Output 'Jenkins: http://127.0.0.1:8080/ (admin password is in the local runtime secrets directory).'
