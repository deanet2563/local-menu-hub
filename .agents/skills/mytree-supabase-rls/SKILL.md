---
name: mytree-supabase-rls
description: Use for Supabase SQL, RLS policies, triggers, SECURITY DEFINER functions, sessions, auth JWT claims, delivery assignment, cancellation history, migrations, or any database change where authorization or concurrency matters.
---

# MyTree Supabase / RLS Safety

## Core rules

- Never weaken RLS or DB guards to make an application bug disappear.
- Backend truth is authoritative for assignment and status transitions.
- Treat every function/trigger/policy change as security-sensitive.
- Keep existing admin bypass behavior scoped and explicit; do not broaden it casually.
- Avoid policy recursion. Prefer carefully scoped SECURITY DEFINER helper functions when necessary.
- Remember UPDATE often requires SELECT visibility as well as UPDATE permission.
- Trigger execution order can affect guard behavior; inspect all triggers on the target table.
- Changing a PostgreSQL function signature may require dropping the old signature explicitly.

## Rider atomic accept checklist

For Rider First Accept:

1. Confirm the offer is still open and the order/delivery is assignable.
2. Lock or update atomically in one authoritative DB transaction/function.
3. Set exactly one `assigned_rider_id` winner.
4. Return deterministic success to the winner.
5. Return deterministic `job_already_taken` to all later contenders.
6. Never allow the client to infer assignment from optimistic UI alone.
7. Record relevant events/history.
8. Notify Shop only after server assignment succeeds.

## Session/auth checklist

- `customer_id` remains the identity anchor.
- Use short-lived access JWTs and revocable persistent sessions.
- Do not expose refresh tokens or refresh-token hashes in logs/tests.
- Logout must revoke the matching server session.
- Session reads/writes must preserve `client_kind` distinctions such as `rider_native` and `shop_native`.

## Migration workflow

1. Inspect current schema, policies, functions, and triggers first.
2. Write the migration so it is safe to run in the intended environment.
3. Preserve existing working signatures unless a deliberate migration changes them.
4. Add comments for non-obvious security/concurrency choices.
5. Test authorized, unauthorized, race, and stale-state paths.
6. Verify no unintended access expansion.
7. Include rollback/forward-fix notes when risk is meaningful.

## Required output

Summarize:

- objects changed,
- authorization invariant,
- concurrency invariant,
- migration/test evidence,
- any production verification still required.
