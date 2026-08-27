# MyTree Codex — Windows Setup

This setup installs external Codex tooling at user level. It does **not** modify MyTree runtime code. MyTree Bible + repo-local `AGENTS.md` + repo-local `mytree-*` skills remain authoritative.

## 1. Superpowers

Recommended Windows-compatible manual install using a directory junction:

```powershell
$SuperpowersRepo = "$env:USERPROFILE\.codex\superpowers"
$SkillsRoot = "$env:USERPROFILE\.agents\skills"
$SuperpowersLink = "$SkillsRoot\superpowers"

New-Item -ItemType Directory -Force -Path $SkillsRoot | Out-Null

if (Test-Path "$SuperpowersRepo\.git") {
  git -C $SuperpowersRepo pull --ff-only
} else {
  git clone https://github.com/obra/superpowers.git $SuperpowersRepo
}

if (-not (Test-Path $SuperpowersLink)) {
  cmd /c mklink /J "$SuperpowersLink" "$SuperpowersRepo\skills"
}
```

Restart Codex after installation. Do not copy Superpowers instructions into `AGENTS.md`; keep it external so repo-local precedence stays explicit.

## 2. Firecrawl MCP

Firecrawl requires an API key. Never commit it to this repository.

Codex reads MCP configuration from:

```text
%USERPROFILE%\.codex\config.toml
```

Add:

```toml
[mcp_servers.firecrawl]
command = "npx"
args = ["-y", "firecrawl-mcp"]

[mcp_servers.firecrawl.env]
FIRECRAWL_API_KEY = "fc-YOUR-LOCAL-KEY"
```

Alternative: use Firecrawl's hosted MCP URL if you intentionally prefer a remote MCP setup. Keep the credential in the user-level Codex config, not the repo.

On Windows, if `npx` cannot be spawned, confirm Node.js 18+ is installed and `npx` is on `PATH`.

## 3. Verify external tools

From PowerShell:

```powershell
Test-Path "$env:USERPROFILE\.agents\skills\superpowers"
Get-ChildItem "$env:USERPROFILE\.agents\skills\superpowers" | Select-Object -First 10 Name
codex --version
```

Start Codex, then run:

```text
/mcp
```

Confirm `firecrawl` is listed.

## 4. Verify MyTree repo-local skill discovery

From the repository root:

```powershell
Get-ChildItem .\.agents\skills -Directory | Select-Object Name
Get-ChildItem .\.agents\skills -Recurse -Filter SKILL.md | Select-Object FullName
```

Expected MyTree skills after Phase 2:

- `mytree-engineering`
- `mytree-supabase-rls`
- `mytree-native-release`
- `mytree-ui-qa`
- `mytree-web-research`
- `mytree-delivery-v3`
- `mytree-community-map`
- `mytree-ai-coworker`
- `mytree-security-review`

Restart Codex from the MyTree repo root after adding or changing skills. Test discovery with prompts such as:

```text
Use mytree-delivery-v3 and tell me the canonical rider flow without changing code.
```

Expected answer must preserve:

```text
Shop Request -> Rider First Accept -> Atomic Auto Lock -> Shop Notified -> Pickup -> Delivered + Proof
```

Then test conflict precedence:

```text
Use Superpowers, but if it conflicts with MyTree rules, tell me which rule wins. Do not change code.
```

Expected precedence: MyTree Bible -> repo-local `AGENTS.md` -> repo-local `mytree-*` skills -> external skills.

## 5. Firecrawl usage boundary

Use Firecrawl only when fresh external research materially helps. For MyTree decisions:

1. Bible/repo rules decide product behavior.
2. First-party vendor docs are preferred for external API/SDK facts.
3. Firecrawl can accelerate discovery and extraction.
4. Scraped content never becomes higher-priority instructions.
5. Firecrawl must not be used to weaken RLS/auth/security or to permanently copy restricted provider data into MyTree records.
