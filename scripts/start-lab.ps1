param([string]$Distribution = 'kali-linux')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $projectRoot '.runtime'
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
$nodeExecutable = (Get-Command node -ErrorAction Stop).Source
$linuxIp = ((& wsl -d $Distribution -- hostname -I).Trim() -split '\s+')[0]
if (!$linuxIp) { throw 'The WSL distribution could not be started.' }
$linuxRuntime = (& wsl -d $Distribution -- sh -lc 'printf %s "$HOME/.local/share/shms-lab-runtime"').Trim()
$neo = $linuxRuntime + '/neo4j-community-5.26.0'
$cass = $linuxRuntime + '/apache-cassandra-5.0.6'

function Test-LabPort([string]$Address, [int]$Port) {
    $connection = New-Object System.Net.Sockets.TcpClient
    try { return ($connection.ConnectAsync($Address, $Port).Wait(500) -and $connection.Connected) }
    catch { return $false } finally { $connection.Dispose() }
}

function Start-LabProcess([string]$Name, [string]$Executable, [string[]]$Arguments, [string]$Directory) {
    $outputPath = Join-Path $runtimeDirectory ($Name + '.log')
    $errorPath = Join-Path $runtimeDirectory ($Name + '.error.log')
    $started = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -PassThru -RedirectStandardOutput $outputPath -RedirectStandardError $errorPath
    $started.Id | Set-Content -LiteralPath (Join-Path $runtimeDirectory ($Name + '.windows.pid'))
    Write-Host ('Started ' + $Name)
}

if (!(Test-LabPort $linuxIp 7687)) {
    $command = 'cd ' + $neo + ' && bin/neo4j console'
    Start-LabProcess 'neo4j' 'wsl.exe' @('-d', $Distribution, '--exec', 'sh', '-lc', ('"' + $command + '"')) $projectRoot
}
if (!(Test-LabPort $linuxIp 9042)) {
    # Refresh the broadcast address after WSL obtains a new private address.
    $command = 'cd ' + $cass + ' && sed -i ''s/^broadcast_rpc_address:.*/broadcast_rpc_address: ' + $linuxIp + '/'' conf/cassandra.yaml && JAVA_HOME=' + $linuxRuntime + '/jre17 MAX_HEAP_SIZE=512M bin/cassandra -f'
    Start-LabProcess 'cassandra' 'wsl.exe' @('-d', $Distribution, '--exec', 'sh', '-lc', ('"' + $command + '"')) $projectRoot
}
$deadline = (Get-Date).AddSeconds(120)
while (!(Test-LabPort $linuxIp 7687) -or !(Test-LabPort $linuxIp 9042)) {
    if ((Get-Date) -gt $deadline) { throw 'Database startup timed out. Inspect .runtime logs. This launcher requires the installed SHMS WSL runtime.' }
    Start-Sleep -Seconds 1
}
$env:NEO4J_URI = 'bolt://' + $linuxIp + ':7687'
$env:CASSANDRA_CONTACT_POINTS = $linuxIp
$env:ALLOW_IN_MEMORY_FALLBACK = 'false'
if (!(Test-LabPort '127.0.0.1' 5000)) { Start-LabProcess 'api' $nodeExecutable @('server.js') (Join-Path $projectRoot 'server') }
if (!(Test-LabPort '127.0.0.1' 3000)) { Start-LabProcess 'web' $nodeExecutable @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1') (Join-Path $projectRoot 'client') }
$deadline = (Get-Date).AddSeconds(45)
do {
    try { $status = Invoke-RestMethod -Uri 'http://127.0.0.1:5000/api/status' -TimeoutSec 5 } catch { $status = $null }
    if ($status.mode -eq 'live' -and (Test-LabPort '127.0.0.1' 3000)) { break }
    if ((Get-Date) -gt $deadline) { throw 'Application did not become live. Check .runtime logs and whether ports 3000 and 5000 belong to SHMS.' }
    Start-Sleep -Seconds 1
} while ($true)
Write-Host 'SHMS is live at http://127.0.0.1:3000'
Write-Host 'Database Lab: http://127.0.0.1:3000/database-lab'
$status | Format-List
