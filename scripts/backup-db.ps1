# backup-db.ps1 — respaldo lógico de la BD (plan gratuito Supabase = sin backups automáticos)
# Uso:  $env:TESEY_DB_URL = "postgresql://postgres.czbmqzimjlwwgcglubey:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:5432/postgres"
#       powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
# Requiere pg_dump (Postgres client tools) O usa la variante npx de abajo.
# ponytail: script mínimo con rotación. Guarda los .sql FUERA del repo (datos financieros).

$ErrorActionPreference = "Stop"
$dbUrl = $env:TESEY_DB_URL
if (-not $dbUrl) { throw "Falta la variable TESEY_DB_URL con el connection string de Supabase." }

$dest = Join-Path $HOME "tesey-backups"
if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest | Out-Null }
$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$file = Join-Path $dest "tesey_$stamp.sql"

# Volcado completo (esquema + datos). Alternativa sin instalar nada:
#   npx supabase db dump --db-url $dbUrl -f $file
pg_dump $dbUrl -f $file
Write-Host "Backup OK: $file"

# Rotación: conservar los últimos 8
Get-ChildItem $dest -Filter "tesey_*.sql" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 8 |
  Remove-Item -Force

# --- Para programarlo SEMANAL (correr una vez, en PowerShell como admin) ---
# schtasks /Create /SC WEEKLY /D SUN /TN "Tesey DB Backup" /TR `
#   "powershell -ExecutionPolicy Bypass -File C:\Users\eavm__sz\tesey-app\scripts\backup-db.ps1" /ST 03:00
