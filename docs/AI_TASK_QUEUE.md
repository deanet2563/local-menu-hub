# MyTree AI Task Queue

Updated: 2026-09-09

This queue is the canonical coordination view for parallel Codex work. It does not replace detailed GitHub issues/PRs; it defines ownership, dependencies, and release order.

## Active lanes

| Lane | Owner | Current objective | Priority | Dependency / gate |
|---|---|---|---|---|
| L1 Shop | AI-2 Shop Engineer | Finish Shop Native Phase 1 production readiness | P0 | Existing `local-menu-hub` PR #76; requires paired Worker/DB verification |
| L2 Backend | AI-4 Backend/DB Engineer | Finish authoritative customer delivery pricing + reusable customize integration | P0 | Existing `mytree-worker` PR #53; paired migrations + E2E |
| L3 Rider | AI-3 Rider Engineer | Finalize Rider Native real-device UX, incoming offer/audio/push/history and Delivery V3 completeness | P0 | Preserve atomic First Accept; backend changes routed through L2 |
| L4 Customer | AI-1 Customer Engineer | Multi-store cart + Home/Discovery continuation without regressing checkout | P1 | Any shared order schema/API via L2 |
| L5 Community | AI-5 Community Engineer | Community Thailand foundation: IA/data-contract proposal and first isolated product slice | P1 | Shared schema/moderation contracts require L2/L6 review |
| L6 AI Ops | AI-6 AI Operations Engineer | AI Co-worker foundation: event model, orchestrator boundaries, audit/exception architecture | P1 | Event schema coordinated with L2; no autonomous high-risk actions initially |
| L7 QA/Release | AI-7 QA/Release Agent | Independent review of L1-L6, CI/security/release gating | P0 continuous | Must remain independent of feature completion claims |

## Immediate release train

### Release Train A — Local Commerce Pilot hardening
1. Verify/apply Shop Native migrations from PR #76 against the live-compatible schema.
2. Verify Worker PR #53 CI + signed delivery-pricing/order contract.
3. Confirm reusable Shop Customize server validation and keep frontend flag OFF until backend/DB verification passes.
4. Verify legacy `sub_orders.amount` semantics before final customer grand-total wording.
5. Complete Shop APK real-device verification.
6. Complete Customer LIFF checkout verification for distance/free/flat delivery and quote invalidation.
7. Complete Rider Native offer/push/audio/pickup/delivery-proof flow on a real device.
8. QA cross-flow: Customer → Shop → Rider → Pickup → Delivered → Review/History.

### Release Train B — Parallel platform expansion
May proceed in separate branches while Release Train A is being hardened, but must not modify shared production contracts without Backend/DB ownership.

- Customer multi-store cart architecture and UX
- Customer Home / discovery rows / ads surfaces
- Community foundation
- AI Operations foundation
- Admin exception-queue design

## Lane contracts

### L1 Shop
Allowed direct ownership:
- `apps/shop-native/**`
- Shop-only presentation/state code

Requires Backend/DB request:
- new tables/columns/RPCs/RLS/triggers
- shared order/payment/delivery semantics
- push producer contracts

### L2 Backend/DB
Exclusive shared ownership:
- `mytree-worker/**`
- `supabase/migrations/**`
- shared RPC/RLS/trigger/state-machine/event contracts
- production schema sequencing

### L3 Rider
Allowed direct ownership:
- `apps/rider-native/**`
- Rider-only UX/state/audio/navigation/presentation

Backend dependency required for:
- assignment RPC/state change
- notification producer contract
- delivery event schema
- proof/storage authorization changes

### L4 Customer
Allowed direct ownership:
- customer web/LIFF components/routes/state
- cart UX and home/discovery presentation

Backend dependency required for:
- cross-shop checkout/order contract changes
- shared pricing/payment schema
- durable favorites/points/history schema

### L5 Community
Start with isolated architecture/UI contracts. Do not create production shared schema outside L2.

Initial outputs:
- Community IA
- neighborhood/community identity model proposal
- post/feed/group/event/marketplace domain model proposal
- moderation states and escalation needs
- Community Map integration boundaries

### L6 AI Ops
Start with observe/suggest architecture before autonomous actions.

Initial outputs:
- platform event taxonomy
- agent registry
- policy/risk levels
- confidence thresholds
- immutable AI action audit model proposal
- human exception queue contract
- per-agent kill switch/control-plane proposal
- evaluation/quality metrics

### L7 QA/Release
Must verify evidence rather than accept “done” claims.

Required checks:
- source diff
- CI result
- migration/RLS implications
- dependency status
- feature flag state
- manual/real-device evidence
- rollback/disable strategy

## Status language
Use only these states:
- `PLANNED`
- `IN_PROGRESS`
- `BLOCKED`
- `CODE_COMPLETE`
- `CI_GREEN`
- `STAGING_VERIFIED`
- `REAL_DEVICE_VERIFIED`
- `PRODUCTION_READY`
- `RELEASED`

Never equate `CODE_COMPLETE` with `RELEASED`.

## Current known high-risk shared areas
- `sub_orders` accounting semantics
- order creation/pricing authority
- Rider assignment/acceptance state machine
- RLS / SECURITY DEFINER / triggers
- LINE/native auth/session contracts
- proof/payment storage authorization
- shared notification/event contracts

Multiple feature agents must not edit these independently.
