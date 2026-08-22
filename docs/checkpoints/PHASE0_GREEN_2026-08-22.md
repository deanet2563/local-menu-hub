# MyTree.cc — Phase 0 GREEN Production Checkpoint

**Status:** PHASE 0 GREEN  
**Verified:** 2026-08-22 (Asia/Bangkok)  
**Scope:** Source-of-truth reconciliation, Ordering V2 regression protection, production DB/Worker hardening and live regression gates.

## Production checkpoints

- Canonical customer ordering endpoint: `POST /order` -> Ordering V2.
- Canonical Worker source: `mytree-worker/main` -> `src/workerV3.ts` -> `src/worker.ts` -> `src/orderV2.ts`.
- Production Worker URL: `https://mytree-worker.kompakorn-t.workers.dev`.
- Production Worker Version ID after preorder LINE notification rollout: `0ce53230-67a2-4b51-8f67-5a887ce148e5`.
- Canonical NEW Supabase migration owner from 2026-08-21 onward: `deanet2563/mytree-worker/supabase/migrations/`.
- `local-menu-hub/supabase/migrations/` is historical/frozen for new production migrations.
- Production migration applied: `20260821 | phase0_order_atomic_destination`.

## DB / RPC verification

Production postflight verified:

- legacy `fn_create_order_v2(text,jsonb,jsonb,uuid,...)` remains during rollout;
- new `fn_create_order_v2(text,jsonb,jsonb,numeric,numeric,uuid,...)` exists;
- new overload is `SECURITY DEFINER`;
- `anon` execute = false;
- `authenticated` execute = false;
- `service_role` execute = true;
- `sub_orders.requested_for` exists;
- `sub_orders.delivery_destination_lat` exists;
- `sub_orders.delivery_destination_lng` exists;
- `order_line_configurations` exists.

## Live regression gates — PASSED

### Ordering core

- Pickup order creation: PASS.
- Delivery order creation: PASS.
- Shop receives new-order native push: PASS.
- Customer LINE order notification: PASS.
- Shop order detail/inbox receives order: PASS.
- Server-authoritative totals remained correct in tested orders: PASS.
- Set/group presentation and persisted grouping: PASS.
- Options/test configuration remained visible through checkout/order flow: PASS.

### Delivery destination

- Delivery without coordinates is blocked at the customer/Worker boundary.
- Delivery coordinates are now stored in the same server-side order transaction.
- Live production examples verified non-null destination coordinates in `sub_orders`.
- `delivery_status = needs_rider` remains correct for new delivery orders.

### QR payment UX

- Unpaid QR-transfer orders show the shop QR again in Customer Order History.
- Customer can open/save the QR later.
- Existing slip-upload flow remains available.

### Preorder

- `requested_for` persists in production.
- Customer Order History prominently displays preorder date/time.
- Shop Web Order Inbox prominently displays preorder date/time.
- Shop Native Order Detail supports preorder date/time.
- LINE shop notification now sends an explicit preorder schedule notice after successful preorder creation.
- Asia/Bangkok time formatting verified in live flow.

### Availability guards

- Manual shop close: PASS. Closed shop disappears from customer discovery/order entry, preventing order creation; Worker also retains server-side `is_open` guard.
- Business-hours guard: PASS. Order outside configured requested time was rejected.
- Rejected out-of-hours test created no order and generated no Shop/LINE new-order notification.

## Source-side protections completed

- Shop manual open/closed enforcement in Worker.
- Business-hours enforcement in Worker for immediate and scheduled orders.
- Atomic destination lat/lng persistence.
- Required delivery coordinate guard.
- Notification failure remains non-transactional/best-effort so order creation does not rollback solely due to push failure.
- Firebase Admin credential filename pattern is ignored by Git to reduce accidental secret commits.
- Shop Native source was reconciled into the canonical frontend branch and CI-proven.

## Phase 0 exit gate

The Phase 0 exit gate is satisfied:

> Current customer Ordering V2 works in production; production DB/Worker state is known and reproducible; delivery coordinates, preorder, QR history, manual close and business-hours guards have been live tested; source/migration ownership is defined.

**PHASE 0 GREEN.**

## Next active phase

**PHASE 1 — Shop Native App operational completion**

Execution priority:

1. persistent revocable session + silent refresh;
2. Shop order inbox/detail synchronization;
3. reliable native new-order push/resume behavior;
4. accept/reject and preparing/ready operational states;
5. open/close parity;
6. menu CRUD / availability / options / sets parity;
7. shop profile/location/payment settings parity;
8. background/resume synchronization;
9. remove operational dependence on Shop LINE Rich Menu.

Do not start Rider V3 implementation by extending the legacy `Rider Interested -> Shop Select Rider` candidate flow. Phase 2 must implement the approved atomic first-accept model.
