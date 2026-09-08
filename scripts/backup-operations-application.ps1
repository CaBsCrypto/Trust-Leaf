param(
  [Parameter(Mandatory=$true)][string]$CliPath,
  [string]$ProjectRef = 'zohgdvzjhxoviiwqyzgs',
  [string]$BackupDirectory = 'D:\00 CODEX - OPENIA\.backups\trustleaf'
)
$ErrorActionPreference = 'Stop'
if ($ProjectRef -ne 'zohgdvzjhxoviiwqyzgs') { throw 'Unexpected project for this release.' }
$repo = Split-Path $PSScriptRoot -Parent
function Read-Database([string]$Sql) {
  $json = (& $CliPath db query --linked --project-ref $ProjectRef $Sql -o json 2>$null) -join "`n"
  if ($LASTEXITCODE -ne 0) { throw 'Backup database read failed; no migration was applied.' }
  return ($json | ConvertFrom-Json -Depth 100).rows
}
$tables = @(Read-Database "select table_schema,table_name from information_schema.tables where table_type='BASE TABLE' and (table_schema='trustleaf_private' or (table_schema='public' and table_name like 'trustleaf_%')) order by table_schema,table_name")
if ($tables.Count -eq 0) { throw 'Application table inventory is empty.' }
$pairs = foreach ($table in $tables) {
  if ($table.table_schema -notmatch '^[a-z_]+$' -or $table.table_name -notmatch '^[a-z_]+$') { throw 'Unexpected table identifier.' }
  $name = "$($table.table_schema).$($table.table_name)"
  "'$name',coalesce((select jsonb_agg(to_jsonb(t)) from $name t),'[]'::jsonb)"
}
$query = @"
select jsonb_build_object(
  'createdAt',clock_timestamp(),
  'tables',jsonb_build_object($($pairs -join ',')),
  'columns',(select jsonb_agg(jsonb_build_object('schema',table_schema,'table',table_name,'column',column_name,'type',udt_name) order by table_schema,table_name,ordinal_position) from information_schema.columns where table_schema='trustleaf_private' or (table_schema='public' and table_name like 'trustleaf_%')),
  'migrations',(select jsonb_agg(to_jsonb(m) order by version) from supabase_migrations.schema_migrations m),
  'sequences',(select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from pg_sequences s where schemaname='trustleaf_private'),
  'functions',(select jsonb_agg(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and (n.nspname='trustleaf_private' or (n.nspname='public' and p.proname like 'trustleaf_%')))
) as snapshot
"@
$snapshot = (Read-Database $query)[0].snapshot
$schema = foreach ($migration in $snapshot.migrations) {
  $files = @(Get-ChildItem -LiteralPath (Join-Path $repo 'supabase/migrations') -Filter "$($migration.version)_*.sql")
  if ($files.Count -ne 1) { throw "Missing reviewed migration $($migration.version)." }
  @{ version=$migration.version; sql=[IO.File]::ReadAllText($files[0].FullName) }
}
$payload = @{ project=$ProjectRef; scope='TrustLeaf application tables and functions; excludes Auth, Storage, Vault and platform configuration'; schemaMigrations=@($schema); snapshot=$snapshot } | ConvertTo-Json -Depth 100 -Compress
Add-Type -AssemblyName System.Security
$bytes = [Text.Encoding]::UTF8.GetBytes($payload)
$protected = [Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
[IO.Directory]::CreateDirectory($BackupDirectory) | Out-Null
$path = Join-Path $BackupDirectory ("application-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dpapi')
[IO.File]::WriteAllBytes($path,$protected)

# Decrypt the persisted file into stdin only; never create a plaintext backup or log rows.
$clear = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($path),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
$start = [Diagnostics.ProcessStartInfo]::new((Get-Command node).Source)
$start.ArgumentList.Add((Join-Path $repo 'tests/sql/verify-application-backup.mjs'))
$start.WorkingDirectory=$repo; $start.UseShellExecute=$false; $start.CreateNoWindow=$true
$start.RedirectStandardInput=$true; $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
$process = [Diagnostics.Process]::Start($start)
$process.StandardInput.Write([Text.Encoding]::UTF8.GetString($clear)); $process.StandardInput.Close()
$outputTask=$process.StandardOutput.ReadToEndAsync(); $errorTask=$process.StandardError.ReadToEndAsync()
$process.WaitForExit()
[Array]::Clear($bytes,0,$bytes.Length); [Array]::Clear($clear,0,$clear.Length)
if ($process.ExitCode -ne 0) { throw "Encrypted backup saved at $path, but isolated restore failed. Migration remains blocked." }
$result = $outputTask.GetAwaiter().GetResult() | ConvertFrom-Json
@{ path=$path; sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash; restoredTables=$result.tables; restoredRows=$result.rows; scope='application-only'; encryption='Windows DPAPI CurrentUser' } | ConvertTo-Json
