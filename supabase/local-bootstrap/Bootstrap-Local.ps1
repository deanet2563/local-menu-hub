[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$bootstrapRoot = $PSScriptRoot
$workRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('mytree-local-bootstrap-' + [guid]::NewGuid().ToString('N'))
$migrationRoot = Join-Path $workRoot 'supabase\migrations'
$projectId = $null

function Invoke-LocalSupabase {
  param(
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [switch]$AllowFailure
  )

  Write-Host ("> supabase " + ($Arguments -join ' '))
  & supabase @Arguments
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0 -and -not $AllowFailure) {
    throw "supabase command failed with exit code $exitCode"
  }
  return $exitCode
}

function Copy-ReplayMigration {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Version,
    [Parameter(Mandatory = $true)][string]$Name
  )

  Copy-Item -LiteralPath (Join-Path $repoRoot $Source) -Destination (Join-Path $migrationRoot ($Version + '_' + $Name + '.sql'))
}

function Get-LocalDbContainer {
  $container = 'supabase_db_' + $projectId
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    $running = (& docker inspect --format '{{.State.Running}}' $container 2>$null)
    if ($LASTEXITCODE -eq 0 -and $running.Trim() -eq 'true') {
      return $container
    }
    Start-Sleep -Seconds 1
  }
  throw "expected disposable local database container is not running: $container"
}

function Invoke-LocalPsqlFile {
  param([Parameter(Mandatory = $true)][string]$File)

  $container = Get-LocalDbContainer
  Write-Host ("> psql local container $container -f $File")
  Get-Content -LiteralPath $File -Raw | & docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -
  if ($LASTEXITCODE -ne 0) {
    throw "local psql script failed: $File"
  }
}

function Invoke-LocalPsqlQuery {
  param([Parameter(Mandatory = $true)][string]$Query)

  $container = Get-LocalDbContainer
  Write-Host ("> psql local container $container -c $Query")
  & docker exec $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c $Query
  if ($LASTEXITCODE -ne 0) {
    throw "local psql query failed"
  }
}

try {
  New-Item -ItemType Directory -Path $migrationRoot -Force | Out-Null
  Invoke-LocalSupabase @('init', '--workdir', $workRoot, '--yes')
  $projectId = ((Get-Content (Join-Path $workRoot 'supabase\config.toml') | Select-String '^project_id\s*=\s*"([^"]+)"$').Matches[0].Groups[1].Value)

  Copy-ReplayMigration 'supabase/local-bootstrap/20260808_remote_schema.sql' '20260808000000' 'historical_baseline'
  Copy-ReplayMigration 'supabase/migrations/20260809_menu_item_archiving.sql' '20260809000000' 'menu_item_archiving'
  Copy-ReplayMigration 'supabase/migrations/20260809_shop_profile_separation.sql' '20260809010000' 'shop_profile_separation'
  Copy-ReplayMigration 'supabase/migrations/20260810150500_ordering_options_bundles.sql' '20260810150500' 'ordering_options_bundles'
  Copy-ReplayMigration 'supabase/migrations/20260811063000_order_line_configurations.sql' '20260811063000' 'order_line_configurations'
  Copy-ReplayMigration 'supabase/migrations/20260811070000_fn_create_order_v2.sql' '20260811070000' 'fn_create_order_v2'
  Copy-ReplayMigration 'supabase/migrations/20260811090000_preorder_requested_for_v2.sql' '20260811090000' 'preorder_requested_for_v2'
  Copy-ReplayMigration 'supabase/migrations/20260811110000_ordering_v2_test_seed.sql' '20260811110000' 'ordering_v2_test_seed'
  Copy-ReplayMigration 'supabase/migrations/20260811123000_repair_ordering_v2_test_encoding.sql' '20260811123000' 'repair_ordering_v2_test_encoding'
  Copy-ReplayMigration 'supabase/local-bootstrap/20260813_rider_candidate_flow.sql' '20260813000000' 'rider_candidate_flow'
  Copy-ReplayMigration 'supabase/migrations/20260816_rider_job_v2_delivery_pricing.sql' '20260816000000' 'rider_job_v2_delivery_pricing'
  Copy-ReplayMigration 'supabase/migrations/20260816_rider_job_v2_security_definer.sql' '20260816010000' 'rider_job_v2_security_definer'
  Copy-ReplayMigration 'supabase/migrations/20260820_shop_storage_ascii_rls.sql' '20260820000000' 'shop_storage_ascii_rls'
  Copy-ReplayMigration 'supabase/migrations/20260820_shop_storage_customer_claim_rls.sql' '20260820010000' 'shop_storage_customer_claim_rls'

  Get-ChildItem (Join-Path $repoRoot 'supabase/migrations') -Filter '*.sql' |
    Where-Object { $_.Name -notmatch '^202608(09|16|20)_' } |
    Sort-Object Name |
    ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $migrationRoot $_.Name) }

  # These UI/observability services are not required for schema/backfill
  # rehearsal and are unhealthy or slow to become ready in the current Windows
  # Docker setup. The database, API, and query services remain enabled.
  Invoke-LocalSupabase @(
    'start', '--workdir', $workRoot,
    '--exclude', 'storage-api',
    '--exclude', 'logflare',
    '--exclude', 'postgres-meta',
    '--exclude', 'studio'
  )

  Invoke-LocalPsqlFile (Join-Path $bootstrapRoot 'verify_local_schema.sql')
  Invoke-LocalPsqlQuery "select count(*) as migration_count, max(version) as current_migration from supabase_migrations.schema_migrations;"
  Invoke-LocalPsqlQuery "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('shops','menu_items','customers','hub_orders','sub_orders','order_items','delivery_candidate_interests','shop_menu_categories','shop_customize_groups','shop_customize_options','menu_item_customize_groups') order by table_name;"
  Invoke-LocalSupabase @('migration', 'list', '--local', '--workdir', $workRoot)

  Write-Host '--- canonical backfill rehearsal ---'
  Invoke-LocalPsqlFile (Join-Path $repoRoot 'supabase/ops/customize_canonical_backfill.sql')

  Write-Host '--- canonical parity ---'
  Invoke-LocalPsqlFile (Join-Path $repoRoot 'supabase/ops/customize_canonical_parity.sql')

  Write-Host '--- canonical assertions ---'
  Invoke-LocalPsqlFile (Join-Path $repoRoot 'supabase/tests/customize_canonical_migration.test.sql')

  Write-Host '--- canonical rollback and drift protection ---'
  Invoke-LocalPsqlFile (Join-Path $repoRoot 'supabase/ops/customize_canonical_rollback.sql')

  Write-Host 'LOCAL BOOTSTRAP AND CANONICAL REHEARSAL: PASS'
}
finally {
  if (Test-Path $workRoot) {
    Invoke-LocalSupabase @('stop', '--workdir', $workRoot, '--no-backup', '--yes') -AllowFailure
    Remove-Item -LiteralPath $workRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
