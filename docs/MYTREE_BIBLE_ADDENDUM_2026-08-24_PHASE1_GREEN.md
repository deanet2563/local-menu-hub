# MyTree.cc Bible Addendum — Phase 1 GREEN

**Checkpoint date:** 2026-08-24  
**Applies to:** `docs/MYTREE_BIBLE.md` roadmap Phase 1  
**Status:** PHASE 1 GREEN ✅

This addendum records the completed production checkpoint for **PHASE 1 — Shop Native App operational completion / persistent session foundation**. It supplements the 2026-08-20 Bible snapshot and should be read as the latest approved status for Phase 1.

## Production gates proven

- Android Shop Native app opens on a real physical device without launch crash.
- Native LINE Login succeeds.
- Shop App loads owned-shop operational data and order detail under the existing MyTree identity/RLS model.
- Session survives app close/reopen without repeated LINE Login.
- Logout returns to Login and remains logged out after close/reopen.
- Logout revokes the server-side `app_sessions` row (`revoked_at` populated), rather than only deleting local state.
- Controlled silent-refresh test passed with a temporary 2-minute access-token TTL.
- Production `app_sessions.last_used_at` advanced from `2026-08-23 17:28:45 UTC` to `2026-08-23 17:31:03 UTC`, proving Worker refresh execution and refresh-token rotation.
- Temporary test TTL was reverted after proof; canonical Worker `main` uses `ACCESS_TTL_SECONDS = 60 * 60` and refresh/session lifetime remains 30 days.
- Production Worker after restoration was deployed as Version ID `829de570-0eb6-4c12-b8e7-9254e9131e29`.
- Shop Native preview EAS public client configuration is now source-controlled so future preview builds do not omit required `EXPO_PUBLIC_*` values.

## Architecture confirmed

```text
First login
  -> Native LINE Login
  -> Worker verifies LINE identity
  -> short-lived Supabase-compatible access JWT
  -> long-lived revocable app session / refresh credential
  -> Expo SecureStore

Later app open
  -> restore local session
  -> use valid access JWT
  -> when expired: Worker silent refresh + refresh-token rotation
  -> remain inside Shop App without LINE Login

Logout
  -> Worker revoke
  -> local session removed
  -> next launch requires Login
```

`customer_id` remains the identity anchor. No service-role key, JWT signing secret, LINE channel secret, or private admin credential is stored in the native app.

## Phase 1 regression guard

Do not regress the following while implementing Phase 2:

1. Shop Native persistent session + silent refresh.
2. Logout/revocation semantics.
3. Customer Ordering Flow V2 / Phase 0 GREEN behavior.
4. Existing RLS, guards, and production identity mapping.
5. Public EAS preview configuration required for standalone Shop Native builds.

## Next active phase

**PHASE 2 — Rider Native + Delivery V3 completion** is now the active workstream.

Approved delivery state direction remains:

```text
Shop Request
  -> Rider First Accept
  -> Atomic Auto Lock
  -> Shop Notified
  -> Pickup
  -> Delivered + Proof
```

The legacy `Rider Interested -> Shop Select Rider` model is superseded and must not be extended.

Phase 2 implementation starts with source reconciliation of Rider Native + Worker + DB contract, then persistent Rider session, offer/push, atomic first-accept, pickup/delivered proof, cancellation/reoffer, and append-only delivery history.
