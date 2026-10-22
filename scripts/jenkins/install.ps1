param([string]$Runtime = (Join-Path $env:LOCALAPPDATA 'AppliedSoft/Jenkins'))
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $Runtime | Out-Null
function Get-VerifiedFile($Uri, $Destination, $Expected) {
    if (!(Test-Path -LiteralPath $Destination)) {
        Invoke-WebRequest -Uri $Uri -OutFile $Destination -UseBasicParsing
    }
    $actual = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $Expected) { throw "Checksum mismatch: $Destination" }
}
Get-VerifiedFile 'https://get.jenkins.io/war-stable/2.580.1/jenkins.war' (Join-Path $Runtime 'jenkins.war') '393bf2476352dd726519fd1f92ce66eac7d23c0936e6967420b717060c4c40d0'
Get-VerifiedFile 'https://github.com/jenkinsci/plugin-installation-manager-tool/releases/download/2.15.0/jenkins-plugin-manager-2.15.0.jar' (Join-Path $Runtime 'plugin-manager.jar') 'a86853ec2e2933f37a4b471ba65099b61e03c87a80c2ef8fe2315eb135672d43'
& java -jar (Join-Path $Runtime 'plugin-manager.jar') --war (Join-Path $Runtime 'jenkins.war') --plugin-download-directory (Join-Path $Runtime 'home/plugins') --plugin-file (Join-Path $PSScriptRoot 'plugins.txt') --latest false
if ($LASTEXITCODE -ne 0) { throw 'Plugin installation failed.' }
$secretDirectory = Join-Path $Runtime 'secrets'
New-Item -ItemType Directory -Force $secretDirectory | Out-Null
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
& icacls.exe $secretDirectory /inheritance:r /grant:r "${identity}:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict secret directory permissions.' }
$passwordPath = Join-Path $secretDirectory 'admin-password.txt'
if (!(Test-Path -LiteralPath $passwordPath)) {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    [IO.File]::WriteAllText($passwordPath, [Convert]::ToBase64String($bytes))
}
$init = Join-Path $Runtime 'home/init.groovy.d'
New-Item -ItemType Directory -Force $init | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'setup.groovy') -Destination (Join-Path $init 'assignment5.groovy')
Write-Output "Jenkins installed in $Runtime. Run start.ps1 next."
