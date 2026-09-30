# Moderation Domain Foundation

Status: proposed contract for review. This document is not a production schema or policy migration.

## Production baseline

Verified against frontend commit `d84014974859192975c9aad41553ad23f588fff9` and production Supabase project `ecrxrwfrwuoenjoyhfzw` on 2026-09-30.

| Surface/entity | Production evidence | Moderation readiness |
|---|---|---|
| Community posts and comments | No production table or RPC. The Community Phase 3 routes are in the separate `codex/community-phase3-foundation` branch and use typed prototype fixtures. The prototype has posts but no comment entity. | Fixture IDs and states are not valid moderation targets. |
| Groups, events, help requests, marketplace listings | No production tables or RPCs. Prototype types/cards exist only in the Community fixture branch. Their domain states include `locked`, `cancelled`, `resolved`, `reserved`, and `sold`; those describe the underlying feature lifecycle, not moderation visibility. | Do not accept reports against prototype records. |
| Community boundary and moderator grant | Production has `communities`, `community_memberships`, and `community_moderator_assignments`; they are empty in the baseline. Community data is accessed through permission-scoped RPCs. `fn_has_community_moderator_role(community_id)` checks an active assignment for the JWT `customer_id`. | A scoped moderator grant exists, but no content/report permission contract exists. |
| Shop reviews/replies | `shop_order_reviews.review_id` and `shop_review_replies.reply_id` are UUIDs. Both tables have public SELECT policies; neither has moderation visibility/history fields. Both were empty in the baseline. | Real target records exist, but hiding one safely across all reads is not yet supported. |
| Member | `customers.id` is UUID. `fn_admin_set_member_status(customer_id,status,reason)` owns active/suspended/banned lifecycle and requires `members.action`; it writes `admin_audit_log`. | Reuse the lifecycle RPC; never update `customers` from a moderation-specific path. |
| Shop | `shops.shop_id` is text. `fn_admin_shop_lifecycle(shop_id,action,reason)` owns approve/reject/ban/unban and requires `shops.action`; it writes through the existing audit contract. | Reuse the lifecycle RPC; never update `shops.is_banned` from moderation. |
| Rider | `riders.id` is UUID. `fn_admin_rider_lifecycle(rider_id,action,reason)` owns approve/verify/ban/unban and requires `riders.action`; guard triggers and audit remain authoritative. | Reuse the lifecycle RPC; never update `riders.is_banned` from moderation. |
| Orders/support evidence | Order, payment-slip, and delivery-proof sources exist, but they are not community content and contain sensitive/customer-scoped data. | Not general moderation targets. Expose only a narrowly authorized reference when a case needs it. |

RBAC currently includes `moderation.read/update/action`. `moderation_admin` does not have `members.action`, `shops.action`, or `riders.action`; therefore a moderation action cannot silently gain authority over those owner modules. `marketplace.*` permissions exist, but no production marketplace entity/lifecycle was found.

## Canonical target identity

Use a stable pair `(target_type, target_id)` in moderation records. `target_id` is text because production owner modules use mixed key types. Normalize UUIDs to canonical lowercase UUID text; preserve text keys such as `shops.shop_id` exactly.

| `target_type` | Canonical source key | Admission in first production slice |
|---|---|---|
| `shop_review` | `shop_order_reviews.review_id` (UUID) | Source exists; wait for shared visibility enforcement before accepting reports/actions. |
| `member` | `customers.id` (UUID) | Source and owner lifecycle exist; action remains delegated to Members. |
| `shop` | `shops.shop_id` (text) | Source and owner lifecycle exist; action remains delegated to Shops. |
| `rider` | `riders.id` (UUID) | Source and owner lifecycle exist; action remains delegated to Riders. |
| `community_post`, `community_comment`, `community_group`, `community_event`, `help_request`, `marketplace_listing` | Future source-specific primary keys | Do not admit until the canonical production source, ownership, community scope, and customer read path exist. |

The pair is intentionally not a polymorphic foreign key. A permission-scoped RPC must resolve `target_type`, confirm that the exact source row exists, derive its owner and community scope from that row, and reject unsupported types. A caller must never choose a `community_id` that widens their scope. Keep `community_id` nullable only for genuinely platform-scoped targets; derive it for community targets.

## Minimal report and case contract

Keep a submitted report separate from the review case so multiple reports can refer to the same target without losing reporter-specific notes or provenance.

### `moderation_cases`

- `case_id uuid` primary key
- `target_type text`, `target_id text`, optional verified `community_id uuid`
- `status text`: `open`, `in_review`, `escalated`, `resolved`
- `assigned_to_customer_id uuid` nullable; assignment must respect platform role or exact-community moderator scope
- `reviewed_by uuid`, `reviewed_at timestamptz` nullable
- `decision text`, `decision_reason text` nullable until resolution
- `created_at`, `updated_at timestamptz`
- Preserve closed cases and the target identity; do not hard-delete.

### `moderation_reports`

- `report_id uuid` primary key, `case_id uuid` reference
- `reporter_customer_id uuid` reference to `customers.id`
- `category text`, `submitted_note text` nullable, `created_at timestamptz`
- `audit_id bigint` reference to the trusted audit record for report submission
- Reporter identity must come from the authenticated `customer_id`, not a client parameter.
- Proposed small category set from the product brief: `spam`, `scam_fraud`, `harassment`, `impersonation`, `inappropriate_content`, `prohibited_listing`, `privacy_issue`, `misinformation_local_safety`, `duplicate`, `other`. Treat this as a versioned proposal; do not enable intake until product/policy approves labels and help text.
- Reporter may read a limited status for their own report; full reporter PII and case notes require moderation permission.

### `moderation_case_events`

- Append-only event id, `case_id`, actor, event/action, required reason, optional policy/category, before/after snapshots, timestamp, and `admin_audit_log.audit_id` link.
- Create the event and audit record in the same trusted transaction. Do not expose client writes or allow update/delete.
- Evidence, if added, belongs in a separate private-storage reference table; store bucket/path, not a public URL. Issue signed access only after permission and case-scope checks and audit sensitive reads as appropriate.

This is the proposed minimum contract; no tables, categories, or lifecycle values are applied by this document.

## Visibility and enforcement contract

Moderation visibility is separate from each feature's business lifecycle. A sold listing, resolved help request, cancelled event, or locked group can still be visible. Moderation must not overwrite those states.

For each reportable content row and review, store one `moderation_visibility text not null default 'visible'` with a CHECK constraint using the canonical current values:

- `visible`
- `hidden` — reversible temporary suppression
- `removed` — policy removal while retaining source and evidence

`restored` is a case event/action that returns current visibility to `visible`; it is not a competing terminal visibility value. Every transition requires actor, reason, before/after state, timestamp, and audit linkage.

The owning content row is the single source of current visibility; do not maintain a second visibility mirror in the case table. A permission-scoped decision RPC validates the target, changes its owning row, appends a case event, and writes the audit record in one transaction. Customer reads in list, detail, search, feed, and related-content paths all use the same `moderation_visibility = 'visible'` rule plus the existing community privacy rules. Direct table reads must be protected by RLS using the row's own field, or replaced by narrow read RPCs/views with equivalent checks. Case-detail access to hidden/removed targets is through an authorized, community-scoped path. The current public review SELECT policies must be addressed before review moderation actions are enabled.

Do not add this field to Member, Shop, or Rider as a parallel ban flag. Their canonical lifecycle state and existing customer-surface filters remain authoritative. Do not reuse each feature's business `status` column for moderation visibility.

Member, Shop, and Rider account/entity lifecycle remains owned by the existing module RPCs. A moderation case may record a recommendation/escalation; it may invoke an owner lifecycle action only when the actor also has that module's permission and the call goes through its canonical RPC. A `moderation_admin` role alone is not authority to ban a Member, Shop, or Rider.

Community Moderators can see and act only on cases whose source row resolves to their active assigned `community_id`. They cannot see cross-community cases, reporter PII beyond an approved need, or platform-only evidence. Platform Admin access is broader only through explicit RBAC permissions and audited reads/actions.

## Regression gates before enabling actions

| Target family | Required read-path regression | Authorization/action regression |
|---|---|---|
| Community content | Feed/list, direct detail URL, search, comments, group/event/help/listing details all suppress hidden/removed records consistently while preserving community privacy modes. | Assigned moderator succeeds only inside its community; another community and non-member requests are denied. |
| Reviews | Customer shop/review list, review detail, and shop reply paths all apply the same state; a direct public table query cannot leak hidden/removed content. | Moderation action requires reason and audit; shop reply cannot restore a hidden review. |
| Member | Public/customer account paths honor canonical banned/suspended lifecycle. | Reuse `fn_admin_set_member_status`; cross-module call without `members.action` is denied. |
| Shop | Home, shop directory, shop profile, menu, and ordering eligibility honor canonical shop lifecycle. | Reuse `fn_admin_shop_lifecycle`; cross-module call without `shops.action` is denied. |
| Rider | Directory, availability/offers, and active work eligibility honor canonical rider lifecycle. | Reuse `fn_admin_rider_lifecycle`; cross-module call without `riders.action` is denied. |
| Orders/support references | Only the scoped order owner/support path can read required evidence; no customer addresses, slips, or proofs leak into general case lists. | Signed evidence access is permission checked and audited; no lifecycle mutation is performed through a case detail query. |

Also test duplicate report submission, double action/stale state, case assignment changes, unauthorized direct RPC/table calls, append-only event/audit history, and restore behavior. No test should use production customer content; use isolated staging fixtures.

## Rollout order

1. Implement real report intake only for target types whose source and visibility contracts are ready.
2. Add permission-scoped report/case RPCs and append-only audit/evidence access, tested in staging.
3. Add the shared customer read predicate to every path for each enabled target family; verify cross-surface regressions.
4. Enable deterministic human queue/actions for that family only. Keep unavailable families explicitly unavailable.
5. Add appeals/escalations and AI assistance later; AI may classify or summarize but cannot autonomously enforce.
