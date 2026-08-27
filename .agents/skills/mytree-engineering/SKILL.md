---
name: mytree-engineering
description: Use for MyTree feature work, debugging, refactors, architecture changes, PR planning, implementation sequencing, and any change that could affect Ordering Flow, Rider Flow, auth, native apps, Community Map, or AI Co-worker architecture.
---

# MyTree Engineering

## Purpose

Apply the MyTree project playbook consistently and prevent regressions caused by stale assumptions, legacy flows, or unsafe shortcuts.

## Required inputs

- Current task or bug report.
- Current canonical branch/commit.
- `docs/MYTREE_BIBLE.md`.
- Latest applicable Bible addendum.
- Relevant source files and CI workflow.

## Workflow

1. Read the current Bible and latest applicable addendum before design or implementation.
2. Identify whether the task touches a protected flow: Ordering V2, Rider Delivery V3, auth/session, payment/COD, RLS, cancellation history, Community Map, or AI Co-worker.
3. Inspect current source and trace the actual runtime path before suggesting a fix.
4. State the verified root cause separately from assumptions.
5. Prefer the smallest change that preserves existing GREEN behavior.
6. For concurrent/stateful behavior, keep backend truth authoritative and atomic.
7. Create a dedicated branch from current canonical.
8. Implement only the necessary files.
9. Run the narrowest relevant local checks first, then repo/CI checks.
10. Open a PR with: what changed, why, safety/non-goals, and test gate.
11. Do not merge until required CI is GREEN.
12. If native behavior is involved, require real-device verification before declaring GREEN.

## Protected product rules

- Ordering Flow V2 must not be dismantled by unrelated work.
- Rider canonical flow is `Shop Request -> Rider First Accept -> Atomic Auto Lock -> Shop Notified -> Pickup -> Delivered + Proof`.
- There is no Shop-selection step after Rider accept.
- Phase-1 Rider carries food/packages, not passengers.
- Customer LINE OA keeps customer-facing Rich Menu only; Shop/Rider operations belong in native apps.
- Public SEO pages must not be forced behind LINE login.
- AI is not the source of truth for deterministic business logic; use Rules/SQL for deterministic decisions.

## Stop conditions

Stop and investigate instead of coding when:

- Bible and source conflict and no later decision resolves it.
- The proposed fix requires weakening RLS/guards.
- A delivery state transition is not atomic.
- A native fix cannot be validated without a new build/real-device gate.
- The current branch or canonical commit is ambiguous.

## Completion format

Report:

- root cause / target behavior,
- files changed,
- safety invariants preserved,
- checks run and results,
- PR/merge status,
- remaining real-device or production gate.
