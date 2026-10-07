<#
.SYNOPSIS
  Example MySQL backup script for BuildTrack (Windows / PowerShell).

.DESCRIPTION
  Does NOT hardcode credentials. Pass values as parameters or environment variables.
  Store backups outside the web root. Test restores on a non-production database only.

.EXAMPLE
  $env:BT_DB_HOST='127.0.0.1'
  $env:BT_DB_PORT='3306'
  $env:BT_DB_NAME='buildtrack'
  $env:BT_DB_USER='backup_user'
  $env:BT_DB_PASSWORD='***'
  .\scripts\backup-database.example.ps1
#>

param(
  [string]$HostName = $env:BT_DB_HOST,
  [string]$Port = $(if ($env:BT_DB_PORT) { $env:BT_DB_PORT } else { '3306' }),
  [string]$Database = $env:BT_DB_NAME,
  [string]$User = $env:BT_DB_USER,
  [string]$Password = $env:BT_DB_PASSWORD,
  [string]$OutDir = $(Join-Path (Get-Location) 'backups')
)

if (-not $HostName -or -not $Database -or -not $User) {
  Write-Error 'Set BT_DB_HOST, BT_DB_NAME, BT_DB_USER (and BT_DB_PASSWORD) or pass -HostName/-Database/-User.'
  exit 1
}

if (-not (Get-Command mysqldump -ErrorAction SilentlyContinue)) {
  Write-Error 'mysqldump not found on PATH. Install MySQL client tools or use your host panel backup.'
  exit 1
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outFile = Join-Path $OutDir "buildtrack-$stamp.sql"

$env:MYSQL_PWD = $Password
try {
  & mysqldump -h $HostName -P $Port -u $User --single-transaction --routines --triggers $Database | Set-Content -Path $outFile -Encoding UTF8
  Write-Host "Backup written: $outFile"
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}
