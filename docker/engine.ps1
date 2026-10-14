param([Parameter(ValueFromRemainingArguments=$true)][string[]]$DockerArguments)
# systemd services alone do not keep WSL alive after its last foreground command.
# Keep this dedicated Docker distribution running, without a visible terminal.
$taskKeepAlive = Get-CimInstance Win32_Process -Filter "Name='wsl.exe'" | Where-Object { $_.CommandLine -match 'ChessitoEngine.*--exec sleep infinity' }
if (-not $taskKeepAlive) {
    Start-Process -FilePath wsl.exe -WindowStyle Hidden -ArgumentList @('-d','ChessitoEngine','--exec','sleep','infinity') | Out-Null
}
$taskRepository = Split-Path -Parent $PSScriptRoot
$taskLinuxPath = (& wsl.exe -d ChessitoEngine --exec wslpath -u $taskRepository).Trim()
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& wsl.exe -d ChessitoEngine --cd $taskLinuxPath --exec docker @DockerArguments
exit $LASTEXITCODE
