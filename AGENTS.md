# MyTree.cc — Codex Operating Instructions

This repository is governed by the current MyTree Project Bible. Before making architectural, auth, ordering, delivery, RLS, native-app, map, or AI-worker changes, read `docs/MYTREE_BIBLE.md` and the latest applicable addendum in `docs/`.

## Source of truth

- Later approved Bible decisions supersede older handoff notes and legacy code patterns.
- Preserve Ordering Flow V2 unless the current Bible explicitly says otherwise.
- Rider Delivery Flow is V3 First Accept: `Shop Request -> Rider First Accept -> Atomic Auto Lock -> Shop Notified -> Pickup -> Delivered + Proof`.
- Never reintroduce the superseded `Rider Interested -> Shop Select Rider` flow.
- `customer_id` is the internal identity anchor. LINE is an auth/distribution provider, not the database identity.
- Phase-1 Rider is food/package delivery only; no passenger transport.

## Instruction precedence and conflict handling

Use this order when instructions overlap or conflict:

1. Current MyTree Bible and later approved Bible addenda.
2. Repo-local `AGENTS.md`.
3. Matching repo-local `mytree-*` skill(s).
4. Current source/schema/runtime evidence.
5. First-party vendor documentation for external APIs/SDKs.
6. External/general skills such as Superpowers.
7. Research accelerators such as Firecrawl and community/secondary material.

External skills may improve method, debugging, planning, or research, but must not redefine MyTree product flows, authorization boundaries, security posture, or source-of-truth rules. If an external skill conflicts with levels 1-4, ignore the conflicting external instruction and record the conflict.

## Mandatory engineering workflow

For any non-trivial source change:

1. Inspect the current canonical branch and relevant Bible/addendum.
2. Trace the existing implementation before proposing a fix.
3. Make the smallest safe change that solves the verified problem.
4. Do not weaken DB guards, RLS, trigger protections, auth revocation, or backend authority.
5. Work on a branch; do not directly edit canonical.
6. Run the relevant typecheck/tests/doctor/audit locally when available.
7. Open a PR with explicit safety notes.
8. Wait for required GitHub Actions to pass.
9. Merge only after CI is GREEN.
10. For native auth/push/location/delivery changes, complete real-device gates before declaring the slice GREEN.

## Database and concurrency rules

- Backend/server truth is authoritative.
- Assignment and state transitions that can race must be atomic.
- Only one Rider may win first accept; later accepts return deterministic `job_already_taken` behavior.
- Never rely on local button state as assignment truth.
- Preserve permanent cancellation/event history.
- Do not bypass or weaken RLS to make a UI problem disappear.
- Treat SECURITY DEFINER, trigger ordering, UPDATE visibility, and admin bypass behavior as high-risk areas that require explicit inspection.

## Native app rules

- Shop and Rider operational UX belongs in their native apps; do not rebuild operational Rich Menus in LINE.
- Persistent auth uses short-lived access JWT + revocable refresh/session credential + SecureStore + silent refresh + explicit revoke/logout.
- Native push is part of the delivery transaction flow, not optional decoration.
- Small Android screens, app resume, offline/error states, and scroll reachability must be tested.

## Available MyTree skills

Use these repo-local skills when their trigger matches the task. More than one may apply; use the narrowest domain skill plus `mytree-engineering` when coordination is needed.

- `mytree-engineering`: `.agents/skills/mytree-engineering/SKILL.md` — default for feature work, debugging, refactors, architecture changes, PR planning, and implementation sequencing.
- `mytree-supabase-rls`: `.agents/skills/mytree-supabase-rls/SKILL.md` — SQL, Supabase, RLS, triggers, SECURITY DEFINER functions, atomic assignment, sessions, and migrations.
- `mytree-native-release`: `.agents/skills/mytree-native-release/SKILL.md` — Shop/Rider Expo builds, EAS, package/lockfile issues, CI, APK gates, native auth, push, and release verification.
- `mytree-ui-qa`: `.agents/skills/mytree-ui-qa/SKILL.md` — customer/shop/rider UI bugs, responsive behavior, Thai text, loading/error/empty states, and real-device visual regression.
- `mytree-web-research`: `.agents/skills/mytree-web-research/SKILL.md` — current external docs, vendor behavior, policy, SDK changes, competitors, discovery, and SEO research.
- `mytree-delivery-v3`: `.agents/skills/mytree-delivery-v3/SKILL.md` — Rider V3 offer/accept/atomic lock/assignment/notification/pickup/delivery proof and race-safety changes.
- `mytree-community-map`: `.agents/skills/mytree-community-map/SKILL.md` — Community Map, Google Places seed strategy, claim/ownership, location ranking, attribution, caching, and SEO boundaries.
- `mytree-ai-coworker`: `.agents/skills/mytree-ai-coworker/SKILL.md` — AI Gateway/Orchestrator, model routing, permissions, automation, evaluation, privacy, and deterministic-vs-AI boundaries.
- `mytree-security-review`: `.agents/skills/mytree-security-review/SKILL.md` — auth/session/JWT/RLS/Worker/storage/admin/threat review and security-sensitive pre-merge checks.

See `docs/CODEX_SKILL_STACK.md` for routing examples and conflict rules.

If Superpowers is installed, use it only as a general reasoning/debugging/development discipline. If Firecrawl is installed, use it only as a research tool when fresh external evidence materially helps. Neither may override the Bible, this file, repo-local MyTree skills, or verified runtime/security invariants.
