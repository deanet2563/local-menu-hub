$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'Set-MyTreeSuperpowersProfile.ps1'

# Parse-only smoke test. This catches PowerShell syntax/interpolation regressions
# without mutating the user's skill discovery profile.
$tokens = $null
$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile(
  $scriptPath,
  [ref]$tokens,
  [ref]$errors
) | Out-Null

if ($errors.Count -gt 0) {
  $errors | ForEach-Object { Write-Error $_.Message }
  exit 1
}

Write-Host 'Set-MyTreeSuperpowersProfile.ps1 parse check: PASS'
