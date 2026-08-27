param(
  [ValidateSet('Core','Full')]
  [string]$Profile = 'Core'
)

$ErrorActionPreference = 'Stop'

$superpowersRepo = Join-Path $env:USERPROFILE '.codex\superpowers'
$skillsRoot = Join-Path $env:USERPROFILE '.agents\skills'
$profileRoot = Join-Path $skillsRoot 'superpowers'
$sourceRoot = Join-Path $superpowersRepo 'skills'

$coreSkills = @(
  'using-superpowers',
  'brainstorming',
  'systematic-debugging',
  'test-driven-development',
  'verification-before-completion',
  'requesting-code-review',
  'finishing-a-development-branch'
)

$fullSkills = @(
  'brainstorming',
  'dispatching-parallel-agents',
  'executing-plans',
  'finishing-a-development-branch',
  'receiving-code-review',
  'requesting-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-git-worktrees',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
  'writing-skills'
)

if (-not (Test-Path (Join-Path $superpowersRepo '.git'))) {
  throw "Superpowers repo not found at $superpowersRepo. Install/update Superpowers first."
}

New-Item -ItemType Directory -Force -Path $skillsRoot | Out-Null

# Remove only the discovery link/profile. Never delete the source repo.
if (Test-Path $profileRoot) {
  cmd /c "rmdir \"$profileRoot\"" 2>$null | Out-Null
  if (Test-Path $profileRoot) {
    Remove-Item -LiteralPath $profileRoot -Force -Recurse
  }
}

New-Item -ItemType Directory -Force -Path $profileRoot | Out-Null

$selected = if ($Profile -eq 'Full') { $fullSkills } else { $coreSkills }

foreach ($skill in $selected) {
  $source = Join-Path $sourceRoot $skill
  $target = Join-Path $profileRoot $skill
  if (-not (Test-Path $source)) {
    throw "Expected Superpowers skill not found: $source"
  }
  cmd /c "mklink /J \"$target\" \"$source\"" | Out-Null
}

Write-Host "Superpowers profile: $Profile"
Write-Host "Active Superpowers skills: $($selected.Count)"
Get-ChildItem -Path $profileRoot -Directory | Select-Object -ExpandProperty Name
Write-Host ''
Write-Host 'Restart Codex to refresh the discovered skill context.'
