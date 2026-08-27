---
name: mytree-delivery-v3
description: Use for Rider Delivery V3 offer, first-accept, atomic lock, rider assignment, shop notification, pickup, delivered proof, cancellation/history, race conditions, push events, or any change touching delivery state transitions.
---

# MyTree Delivery V3

## Canonical flow

`Shop Request -> Rider First Accept -> Atomic Auto Lock -> Shop Notified -> Pickup -> Delivered + Proof`

This flow is authoritative unless a later approved MyTree Bible decision explicitly replaces it.

## Non-negotiable invariants

- Exactly one Rider wins an open delivery request.
- Assignment truth comes from the backend/database, never optimistic UI.
- The first valid accept must atomically set the winner; later accepts return deterministic `job_already_taken` behavior.
- There is no Shop rider-selection step after a Rider accepts.
- Shop notification happens only after assignment succeeds.
- Pickup and Delivered are forward-only state transitions.
- Delivered requires proof according to the current Bible/schema.
- Cancellation and delivery events/history must remain auditable.
- Ordering Flow V2 must not be dismantled to implement delivery changes.
- Never weaken RLS, trigger guards, auth, or concurrency protection to make the flow pass.

## Required inspection

Before changing code:

1. Read `docs/MYTREE_BIBLE.md` and the latest applicable addendum.
2. Trace the current request creation, offer visibility, accept RPC/function, assignment storage, notification, pickup, delivery-proof, and cancellation paths.
3. Inspect relevant RLS policies, SECURITY DEFINER helpers, triggers, and state constraints.
4. Identify every client that reads or mutates delivery state: Shop native, Rider native, customer/order history, Worker/push path, and admin tools.

## Race-safety test matrix

Prove at minimum:

- one Rider accepts an open job -> success;
- two Riders accept near-simultaneously -> one success, one `job_already_taken`;
- stale UI attempts accept after lock -> deterministic rejection;
- unauthorized Rider/customer cannot assign or advance delivery;
- assigned Rider can advance only allowed states;
- proof requirement is enforced for Delivered;
- Shop sees the locked Rider only after backend success;
- cancellation does not orphan assignment/history.

## Completion gate

Report DB/runtime objects touched, concurrency invariant, authorization invariant, notification behavior, CI result, and any real-device verification still required.