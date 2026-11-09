<#
  Letölti a GAUT teljes mentését a saját gépre, ellenőrzi, és csak a legutóbbi N mentést tartja meg.
  Ütemezve (lásd docs/BACKUP.md) napi automatikus külső mentést ad.

  A mentési tokent a GAUT_BACKUP_TOKEN környezeti változóból vagy a -TokenFile fájlból olvassa
  (alapból: %USERPROFILE%\.gaut-backup-token). A token ugyanaz, mint a Renderen a GAUT_BACKUP_TOKEN.
#>
param(
  [string]$Url = 'https://gaut.onrender.com/api/backup',
  [string]$Folder = (Join-Path $env:USERPROFILE 'GAUT-mentesek'),
  [int]$Keep = 30,
  [string]$TokenFile = (Join-Path $env:USERPROFILE '.gaut-backup-token')
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
New-Item -ItemType Directory -Force $Folder | Out-Null
$log = Join-Path $Folder 'mentes.log'
function Log($text) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $text" | Add-Content -Path $log -Encoding UTF8 }

try {
  $token = $env:GAUT_BACKUP_TOKEN
  if (-not $token -and (Test-Path $TokenFile)) { $token = (Get-Content $TokenFile -Raw).Trim() }
  if (-not $token) { throw "Nincs mentési token. Állítsd be a GAUT_BACKUP_TOKEN változót, vagy írd a $TokenFile fájlba." }

  $name = 'gaut-mentes-{0}.tar.gz' -f (Get-Date -Format 'yyyyMMdd-HHmm')
  $part = Join-Path $Folder ($name + '.part')
  $final = Join-Path $Folder $name
  # A Render szolgáltatás elindulása percekig tarthat, ezért hosszú időkorlát és egy újrapróbálkozás.
  for ($try = 1; $try -le 2; $try++) {
    try { Invoke-WebRequest -Uri $Url -Headers @{ Authorization = "Bearer $token" } -OutFile $part -UseBasicParsing -TimeoutSec 1800; break }
    catch { if ($try -eq 2) { throw } ; Start-Sleep -Seconds 30 }
  }
  $size = (Get-Item $part).Length
  if ($size -lt 1024) { throw "A letöltött fájl gyanúsan kicsi ($size bájt)." }

  # Ellenőrzés: a tar és a manifest olvasható, és a manifest legalább az adatbázist tartalmazza.
  & tar.exe -tzf $part | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'A letöltött mentés nem olvasható (tar hiba).' }
  $manifest = (& tar.exe -xzOf $part manifest.json) -join "`n" | ConvertFrom-Json
  if ($manifest.format -ne 'gaut-backup-v1' -or -not ($manifest.files | Where-Object name -eq 'gaut.sqlite')) { throw 'A manifest hibás vagy hiányos.' }

  Move-Item $part $final -Force
  Log ("OK {0} ({1:N1} MB, {2} fájl)" -f $name, ($size / 1MB), $manifest.files.Count)

  Get-ChildItem $Folder -Filter 'gaut-mentes-*.tar.gz' | Sort-Object Name -Descending | Select-Object -Skip $Keep | ForEach-Object { Remove-Item $_.FullName -Force; Log "Törölve (régi): $($_.Name)" }
  Write-Output "Kész: $final"
}
catch {
  Log "HIBA $($_.Exception.Message)"
  Get-ChildItem $Folder -Filter '*.part' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  Write-Error $_.Exception.Message
  exit 1
}
