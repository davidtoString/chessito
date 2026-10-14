param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Push-Location $taskRoot
try {
    if (-not $SkipBuild) {
        & .\docker\engine.ps1 compose build
        if ($LASTEXITCODE -ne 0) { throw 'Docker build failed.' }
    }
    $taskAppId = (& .\docker\engine.ps1 image inspect chessito-chessito:latest --format '{{.Id}}').Trim()
    if ($LASTEXITCODE -ne 0) { throw 'App image missing.' }
    $taskEngineId = (& .\docker\engine.ps1 image inspect chessito-engines:latest --format '{{.Id}}').Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Engine image missing.' }
    $taskRelease = (Get-Date -AsUTC -Format 'yyyyMMdd-HHmmss') + '-' + $taskAppId.Substring(7,12)
    $taskFolder = Join-Path $taskRoot "outputs\vps\$taskRelease"
    New-Item -ItemType Directory -Path $taskFolder -ErrorAction Stop | Out-Null
    & .\docker\engine.ps1 image tag chessito-chessito:latest "chessito-app:$taskRelease"
    if ($LASTEXITCODE -ne 0) { throw 'App tagging failed.' }
    & .\docker\engine.ps1 image tag chessito-engines:latest "chessito-engines:$taskRelease"
    if ($LASTEXITCODE -ne 0) { throw 'Engine tagging failed.' }
    Copy-Item -LiteralPath 'compose.vps.yaml' -Destination $taskFolder
    foreach ($taskName in @('ops.sh','vps.env.example','VPS.md')) {
        Copy-Item -LiteralPath (Join-Path 'deploy' $taskName) -Destination $taskFolder
    }
    $taskEncoding = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText((Join-Path $taskFolder 'RELEASE'), "$taskRelease`n", $taskEncoding)
    $taskManifest = @{release=$taskRelease; platform='linux/amd64'; appImage=$taskAppId; enginesImage=$taskEngineId; containsUserData=$false} | ConvertTo-Json
    [System.IO.File]::WriteAllText((Join-Path $taskFolder 'manifest.json'), "$taskManifest`n", $taskEncoding)
    $taskArchive = Join-Path $taskFolder 'images.tar.gz'
    $taskLinuxArchive = (& wsl.exe -d ChessitoEngine --exec wslpath -u $taskArchive).Trim()
    $taskLinuxRoot = (& wsl.exe -d ChessitoEngine --exec wslpath -u $taskRoot).Trim()
    & wsl.exe -d ChessitoEngine --cd $taskLinuxRoot --exec bash deploy/export-images.sh $taskLinuxArchive $taskRelease
    if ($LASTEXITCODE -ne 0) { throw 'Image export failed.' }
    $taskChecksums = foreach ($taskFile in Get-ChildItem -LiteralPath $taskFolder -File | Sort-Object Name) {
        (Get-FileHash -LiteralPath $taskFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + $taskFile.Name
    }
    [System.IO.File]::WriteAllText((Join-Path $taskFolder 'SHA256SUMS'), ($taskChecksums -join "`n") + "`n", $taskEncoding)
    $taskBundle = Join-Path $taskRoot "outputs\vps\chessito-$taskRelease.tar"
    $taskLinuxBundle = (& wsl.exe -d ChessitoEngine --exec wslpath -u $taskBundle).Trim()
    $taskLinuxFolder = (& wsl.exe -d ChessitoEngine --exec wslpath -u $taskFolder).Trim()
    & wsl.exe -d ChessitoEngine --exec tar -cf $taskLinuxBundle -C $taskLinuxFolder compose.vps.yaml ops.sh vps.env.example VPS.md RELEASE manifest.json SHA256SUMS images.tar.gz
    if ($LASTEXITCODE -ne 0) { throw 'Deployment archive creation failed.' }
    $taskBundleHash = (Get-FileHash -LiteralPath $taskBundle -Algorithm SHA256).Hash.ToLowerInvariant()
    [System.IO.File]::WriteAllText(($taskBundle + '.sha256'), "$taskBundleHash  $([System.IO.Path]::GetFileName($taskBundle))`n", $taskEncoding)
    Write-Output "VPS release: $taskFolder"
    Write-Output "Upload archive: $taskBundle"
    Write-Output 'Contains prebuilt images and deployment files. No passwords, database, or encryption keys.'
} finally { Pop-Location }
