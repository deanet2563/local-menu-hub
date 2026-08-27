# MyTree.cc — Codex Operating Instructions

This repository is governed by the current MyTree Project Bible. Before making architectural, auth, ordering, delivery, RLS, native-app, map, or AI-worker changes, read `docs/MYTREE_BIBLE.md` and the latest applicable addendum in `docs/`.

## Source of truth

- Later approved Bible decisions supersede older handoff notes and legacy code patterns.
- Preserve Ordering Flow V2 unless the current Bible explicitly says otherwise.
- Rider Delivery Flow is V3 First Accept: `Shop Request -> Rider First Accept -> Atomic Auto Lock -> Shop Notified -> Pickup -> Delivered + Proof`.
- Never reintroduce the superseded `Rider Interested -> Shop Select Rider` flow.
- `customer_id` is the internal identity anchor. LINE is an auth/distribution provider, not the database identity.
- Phase-1 Rider is food/package delivery only; no passenger transport.

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

Use these repo-local skills when their trigger matches the task:

- `mytree-engineering`: `.agents/skills/mytree-engineering/SKILL.md` — default skill for feature work, debugging, refactors, architecture changes, PR planning, and implementation sequencing.
- `mytree-supabase-rls`: `.agents/skills/mytree-supabase-rls/SKILL.md` — use for SQL, Supabase, RLS, triggers, SECURITY DEFINER functions, atomic assignment, session tables, and DB migrations.
- `mytree-native-release`: `.agents/skills/mytree-native-release/SKILL.md` — use for Shop/Rider Expo builds, EAS, package/lockfile issues, CI, APK gates, native auth, push, and release verification.
- `mytree-ui-qa`: `.agents/skills/mytree-ui-qa/SKILL.md` — use for customer/shop/rider UI bugs, responsive behavior, Thai text, loading/error/empty states, and real-device visual regression checks.
- `mytree-web-research`: `.agents/skills/mytree-web-research/SKILL.md` — use when external documentation, current vendor behavior, policy, SDK changes, or competitor/discovery research is necessary.

If Superpowers is installed, use it as a general reasoning/debugging discipline, but these MyTree skills and the Bible remain the project-specific authority. If Firecrawl is installed, use it only when fresh external web research materially helps; it must never replace first-party docs or MyTree's own source of truth.
