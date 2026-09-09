# Issue 78 Backend/DB Contract Checkpoint

**Date:** 2026-09-09  
**Lane:** AI-4 Backend/DB Engineer  
**Local worktree:** `.worktrees/backend-db-contract-hardening-78`  
**Local branch:** `codex/backend-db-contract-hardening-78`  
**Worker branch inspected/updated:** `deanet2563/mytree-worker:codex/customer-delivery-pricing`

## Current State

- Issue #78 is the single shared Backend/DB ownership lane for the pilot release train.
- Paired Worker PR #53 is the authoritative backend PR for signed customer delivery pricing.
- Paired local-menu-hub PR #76 is the Shop Native/customer integration PR and remains draft.
- `local-menu-hub/supabase/migrations` is a historical/frozen migration lineage per `supabase/migrations/README.md`.
- New production Supabase/Postgres migrations belong in `deanet2563/mytree-worker/supabase/migrations`.
- Live Phase 0 checkpoint records a destination-aware `fn_create_order_v2(text,jsonb,jsonb,numeric,numeric,uuid,...)` overload with `service_role` execute only.

## Contract Findings

- Customer-visible delivery charge and Rider compensation are separate:
  - `sub_orders.customer_delivery_charge`: customer-facing checkout delivery charge.
  - `sub_orders.delivery_fee`: Rider compensation snapshot.
  - `sub_orders.delivery_fee_payer`: no-split payer contract, either `customer` or `shop`.
- `distance` pricing means customer charge follows the authoritative route quote and `delivery_fee_payer = customer`.
- `free` pricing means customer charge is `0` and the shop pays the Rider fee.
- `flat` pricing means the customer pays the merchant-defined customer charge and the shop pays the Rider fee if MyTree Rider is used.
- `sub_orders.amount` is resolved from source/schema evidence as the shop/item subtotal: legacy `fn_create_order` calculates `sum(qty * unit_price)` from validated `p_items`, stores it in `sub_orders.amount`, and updates `hub_orders.total` from `sum(sub_orders.amount)`.
- `sub_orders.amount` and `hub_orders.total` do not include `sub_orders.customer_delivery_charge` in the priced-order migration contract.
- Customer payable total for checkout/receipt wording is `sub_orders.amount + sub_orders.customer_delivery_charge`.
- Rider compensation display must use `delivery_fee` or route-derived `calculated_delivery_fee`; it must never use `customer_delivery_charge`.

## Changes Recorded

- Worker PR #53 now owns the canonical `20260904101500_atomic_customer_delivery_pricing_order_v3.sql` migration.
- The migration creates `fn_create_order_v3_priced`, wraps the live-compatible destination-aware `fn_create_order_v2` overload, and freezes `customer_delivery_charge` plus `delivery_fee_payer` in the same DB transaction.
- The RPC remains `SECURITY DEFINER`, `search_path = public, pg_temp`, revoked from `public`, `anon`, and `authenticated`, and granted only to `service_role`.
- Worker CI now triggers for `supabase/migrations/**` and runs a priced-order migration contract test before the non-deploying `wrangler deploy --dry-run`.
- Worker PR #53 now includes read-only `supabase/ops/priced_order_v3_preflight.sql` for production preflight/postflight capture of amount semantics, required columns/constraints, `fn_create_order_v2` compatibility, and `fn_create_order_v3_priced` privileges.

## Verification Evidence

Worker local checks from `.worktrees/mytree-worker-pr53`:

- `node --test tests/priced-order-migration-contract.test.mjs` -> 2/2 passed.
- `node --test tests/payment-slip-producer.test.mjs` -> 4/4 passed.
- `npx --yes wrangler@latest deploy --dry-run --config wrangler.toml` -> passed, no production deploy.

Follow-up Worker checks from the same worktree:

- `node --test tests/priced-order-migration-contract.test.mjs` -> 4/4 passed after adding amount/payable-total and production preflight assertions.

## Dependencies / Blockers

- No production SQL was run for this checkpoint.
- Applying `20260904101500_atomic_customer_delivery_pricing_order_v3.sql` to live Supabase requires explicit production approval and pre/postflight capture using `supabase/ops/priced_order_v3_preflight.sql`.
- Customer reusable Shop Customize feature flag must remain off until Worker PR #53, DB migration verification, and customer LIFF checkout E2E pass.
- Shop/Rider native APK and real-device gates remain outside this Backend/DB lane.

## Downstream Readiness

- Backend is READY FOR RIDER #79 from a contract perspective: `delivery_fee`/`calculated_delivery_fee` remain Rider compensation, `delivery_fee_payer` remains the no-split payer, and the priced-order RPC does not alter Rider V3 first-accept semantics.
- Backend is READY FOR CUSTOMER #80 for implementation behind the existing feature flag: customer payable total must be displayed as item subtotal plus `customer_delivery_charge`, and reusable Customize should stay disabled until the production migration plus LIFF checkout E2E are verified.
