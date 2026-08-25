[CmdletBinding()]
param(
    [switch]$Check,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$artifactDir = Join-Path $repoRoot 'artifacts\testnet-v2'
$generatedDir = Join-Path $artifactDir '.generated'
$trustWasm = Join-Path $artifactDir 'trust_registry.wasm'
$receiptWasm = Join-Path $artifactDir 'receipt_ledger_v2.wasm'
$trustSpec = Join-Path $generatedDir 'trust_registry.raw.spec.json'
$receiptSpec = Join-Path $generatedDir 'receipt_ledger_v2.raw.spec.json'

New-Item -ItemType Directory -Force -Path $generatedDir | Out-Null

$stellarVersion = (& stellar --version) -join "`n"
if ($LASTEXITCODE -ne 0 -or $stellarVersion -notmatch '(?m)^stellar 26\.0\.0 ') { throw 'Unreviewed Stellar CLI version' }
$rustVersion = (& rustc --version) -join "`n"
if ($LASTEXITCODE -ne 0 -or $rustVersion -notmatch '^rustc 1\.95\.0 ') { throw 'Unreviewed rustc version' }
$cargoVersion = (& cargo --version) -join "`n"
if ($LASTEXITCODE -ne 0 -or $cargoVersion -notmatch '^cargo 1\.95\.0 ') { throw 'Unreviewed cargo version' }

if (-not $SkipBuild) {
    & stellar contract build --manifest-path (Join-Path $repoRoot 'soroban\Cargo.toml') --package trust-registry --out-dir $artifactDir --locked
    if ($LASTEXITCODE -ne 0) { throw 'TrustRegistry local build failed' }
    & stellar contract build --manifest-path (Join-Path $repoRoot 'soroban\Cargo.toml') --package receipt-ledger-v2 --out-dir $artifactDir --locked
    if ($LASTEXITCODE -ne 0) { throw 'ReceiptLedgerV2 local build failed' }
}

$trustJson = & stellar --quiet contract info interface --wasm $trustWasm --output json
if ($LASTEXITCODE -ne 0) { throw 'TrustRegistry local interface extraction failed' }
$receiptJson = & stellar --quiet contract info interface --wasm $receiptWasm --output json
if ($LASTEXITCODE -ne 0) { throw 'ReceiptLedgerV2 local interface extraction failed' }

[IO.File]::WriteAllText($trustSpec, ($trustJson -join [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText($receiptSpec, ($receiptJson -join [Environment]::NewLine), [Text.UTF8Encoding]::new($false))

$nodeArgs = @(
    (Join-Path $PSScriptRoot 'testnet-v2-predeploy-manifest.mjs'),
    '--trust-spec', $trustSpec,
    '--receipt-spec', $receiptSpec
)
if ($Check) { $nodeArgs += '--check' }
& node @nodeArgs
if ($LASTEXITCODE -ne 0) { throw 'Sanitized predeploy manifest validation failed' }
