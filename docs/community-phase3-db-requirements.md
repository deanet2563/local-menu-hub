# Community Phase 3 DB Requirements

Status: requirements specification only. Do not create, apply, or deploy migrations from this document without a separate implementation review.

## Scope And Guardrails

This document prepares the Community Phase 3 database and RLS design for review. It does not define a final migration timestamp and does not claim live Supabase state. Community authorization must use internal `customer_id`; LINE is an authentication/distribution provider and must not become the durable community authorization key.

The local `local-menu-hub/supabase/migrations` directory is a frozen historical lineage. `supabase/migrations/README.md` and `docs/checkpoints/PHASE0_GREEN_2026-08-22.md` both say new production migrations belong in the canonical Worker repository, `deanet2563/mytree-worker/supabase/migrations/`, after live DB reconciliation.

## A. Schema Baseline

### Migration Inventory Read

Confirmed local migration files:

- `20260809_menu_item_archiving.sql`
- `20260809_shop_profile_separation.sql`
- `20260810150500_ordering_options_bundles.sql`
- `20260811063000_order_line_configurations.sql`
- `20260811070000_fn_create_order_v2.sql`
- `20260811090000_preorder_requested_for_v2.sql`
- `20260811110000_ordering_v2_test_seed.sql`
- `20260811123000_repair_ordering_v2_test_encoding.sql`
- `20260816_rider_job_v2_delivery_pricing.sql`
- `20260816_rider_job_v2_security_definer.sql`
- `20260820_shop_storage_ascii_rls.sql`
- `20260820_shop_storage_customer_claim_rls.sql`

Latest local migration timestamp found: `20260820`.

Requested Lane 3 files were not present in this branch or in visible sibling worktrees under `local-menu-hub`:

- `20260910120000_rider_close_job_backend_foundation.sql`
- `20260910123000_rider_delivery_detail_contract.sql`

Those files must be reviewed from the Lane 3 worktree/remote branch before any Community migration is authored.

### Confirmed From Local Migrations

| Object | Confirmed Fact | Source |
|---|---|---|
| `public.shops` | Exists; `shop_id` is `text` primary reference for menu/order domains; has added profile, location, delivery pricing fields. | `20260809_shop_profile_separation.sql`, `20260816_rider_job_v2_delivery_pricing.sql` |
| `public.menu_items` | Exists; has `archived_at`; menu options/bundles reference it. | `20260809_menu_item_archiving.sql`, `20260810150500_ordering_options_bundles.sql` |
| `public.sub_orders` | Exists; has delivery/preorder/destination fields added by historical migrations. | `20260811090000_preorder_requested_for_v2.sql`, `20260816_rider_job_v2_delivery_pricing.sql` |
| `public.order_items` | Exists; has `line_kind`, `bundle_id`, `item_note`, `configuration_snapshot`. | `20260810150500_ordering_options_bundles.sql` |
| `public.order_line_configurations` | Exists in migration lineage; immutable order-line snapshot with RLS SELECT for shop staff. | `20260811063000_order_line_configurations.sql` |
| `public.shop_staff` | Referenced by storage policies and source; local migrations do not create it. | `20260820_*`, source refs |
| `public.platform_admins` | Referenced by admin source; local migrations do not create it. | source refs |
| `public.customers` | Referenced by customer/admin source; local migrations do not create it. | source refs |
| `public.fn_staff_shop_ids()` | Used as existing shop-staff helper; not created in local migrations. | `20260810150500_ordering_options_bundles.sql` |
| `public.fn_current_customer_id_text()` | Created as JWT `customer_id` helper with `auth.uid()` fallback; returns `text`. | `20260820_shop_storage_customer_claim_rls.sql` |
| `SECURITY DEFINER` pattern | Used for service-role order RPC and Rider nearby-job RPC repair; search path is explicitly set. | `20260811070000*`, `20260811090000*`, `20260816_rider_job_v2_security_definer.sql` |
| Storage RLS | Shop asset/QR policies check `shop_staff.customer_id` against JWT `customer_id` helper. | `20260820_shop_storage_customer_claim_rls.sql` |

### Source References, Not Live Proof

Source code references these tables/RPCs: `customers`, `platform_admins`, `shop_staff`, `shops`, `menu_items`, `menu_option_*`, `menu_bundle_*`, `sub_orders`, `riders`, `shop_rider_contacts`, `shop_delivery_queue`, `moderation_reports`, `fn_register_shop`, `fn_create_order`, `fn_shops_near_location`, `fn_customer_cancel_delivery_v3`.

These references help identify integration boundaries, but they must not be treated as live schema proof until Supabase is inspected.

### Live DB Unknowns

- Actual current production/staging schema for `customers`, `shop_staff`, `platform_admins`, Rider/Delivery V3 objects, and `moderation_reports`.
- Whether `fn_current_customer_id_text()` exists in staging/production exactly as local migration defines it.
- Whether a UUID-returning customer helper already exists or should be introduced.
- Existing RLS policies on `customers`, `platform_admins`, `shop_staff`, `shops`, `moderation_reports`, storage buckets, and Rider V3 tables.
- Whether Lane 3 migrations add delivery audit/event patterns that Community should reuse.
- Current extension availability (`pgcrypto`, `citext`, PostGIS, etc.) in target DB.

## B. Proposed Entities

All tables below are requirements, not migration SQL. Prefer `uuid` primary keys with `gen_random_uuid()` if available. Every RLS-protected table must be deny-by-default with explicit policies.

### Entity Requirements

| Entity | Purpose | Primary Key | Foreign Keys | Required Columns | Lifecycle/Status | Uniqueness | CHECK Constraints | Deletion Policy | Indexes | Audit | Visibility |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `communities` | Geographic/organizational boundary such as Sammakorn, school, workplace, zone. | `community_id uuid` | `parent_community_id -> communities` nullable | `slug`, `name`, `boundary_type`, `status`, `default_visibility`, `created_at`, `updated_at` | `draft`, `active`, `paused`, `archived` | `slug`; optional unique `(parent_community_id, slug)` | status enum; visibility enum; no self-parent | Soft archive; no hard delete if referenced | slug, parent, status | status changes audited | Public preview only through view/RPC; full row moderator/admin |
| `community_memberships` | User membership and community-local role. | `membership_id uuid` | `customer_id -> customers(id)`; `community_id -> communities` | `customer_id`, `community_id`, `role`, `status`, `relationship_label`, `verified_at`, `verified_by_customer_id`, timestamps | `pending`, `active`, `suspended`, `left`, `rejected` | one current membership per `(customer_id, community_id)` | role/status/relationship enums | Retain row; mark `left`/`suspended`/`rejected` | customer/status, community/status/role | every verification/status change append-only | Own membership visible to user; active same-community membership lookup via helper only |
| `community_membership_events` | Append-only membership status/verification history. | `event_id uuid` | `membership_id`, `community_id`, `actor_customer_id` nullable | `event_type`, `reason_code`, `note`, `before_status`, `after_status`, `created_at` | append-only | none beyond PK | event/status enums | No hard delete | membership, community/date, actor/date | this is audit source | Moderator/admin; actor/self limited summary if needed |
| `community_groups` | Group/club inside one community; not nested community. | `group_id uuid` | `community_id -> communities`, `owner_customer_id -> customers` | `community_id`, `slug`, `name`, `description`, `visibility`, `status`, `owner_customer_id`, timestamps | `active`, `pending_review`, `hidden`, `archived` | `(community_id, slug)` | visibility/status enum | Soft archive | community/status, owner | create/status/ownership changes | Same-community active members; hidden moderator/admin |
| `community_group_memberships` | Membership in group/club; requires active parent-community membership. | `group_membership_id uuid` | `group_id`, `community_id`, `customer_id` | `role`, `status`, timestamps | `pending`, `active`, `suspended`, `left`, `removed` | one current membership per `(group_id, customer_id)` | role/status enum; community_id must match group | Retain row | group/status, customer/status | status changes audited | Group member, group owner, moderator/admin |
| `community_posts` | Member posts and private feed items. | `post_id uuid` | `community_id`, `author_customer_id`, optional `group_id` | `body`, `visibility`, `moderation_status`, `created_at`, `updated_at`, `hidden_at` | `published`, `pending_review`, `hidden`, `removed`, `archived` | none | body length; visibility/status enums; group community match | Soft hide/remove; preserve audit | community/status/date, author/date, group/date | hide/remove/status changes | Active same-community member; group-scoped if `group_id`; moderator/admin all |
| `community_events` | Community calendar/activity items. | `event_id uuid` | `community_id`, `created_by_customer_id`, optional `group_id` | `title`, `description`, `starts_at`, `ends_at`, `visibility`, `moderation_status`, timestamps | `published`, `pending_review`, `cancelled`, `hidden`, `archived` | optional `(community_id, slug)` if slugs used | `ends_at >= starts_at`; visibility/status enums | Soft cancel/archive | community/date/status, group/date | status changes audited | Active same-community member unless approved public listing |
| `community_help_requests` | Neighbor support, lost/found, requests inside boundary. | `request_id uuid` | `community_id`, `author_customer_id`, optional `group_id` | `title`, `body`, `category`, `request_status`, `visibility`, `moderation_status`, timestamps | `open`, `in_progress`, `resolved`, `closed`, `pending_review`, `hidden` | none | category/status enums | Soft close/hide | community/status/date, author/date | status and moderation events | Active same-community member; owner edit; moderator/admin |
| `community_marketplace_listings` | Local buy/sell/share listings separate from ordering. | `listing_id uuid` | `community_id`, `seller_customer_id`, optional `group_id` | `title`, `description`, `listing_type`, `price_amount`, `currency`, `listing_status`, `visibility`, `moderation_status`, timestamps | `active`, `pending_review`, `reserved`, `closed`, `hidden`, `removed` | none | price non-negative; type/status enums | Soft close/hide | community/status/date, seller/date | listing and moderation events | Active same-community member; owner edit; moderator/admin |
| `community_map_entries` | Public/private MyTree-owned/community-verified map records. | `map_entry_id uuid` | `community_id`, optional `shop_id -> shops`, optional `owner_customer_id` | `name`, `source_type`, `map_layer`, `visibility`, `status`, `lat`, `lng`, `location_precision`, `is_public_indexable`, `approved_by_customer_id`, timestamps | `draft`, `active`, `pending_review`, `hidden`, `archived` | `(community_id, slug)` if slug; optional unique external reference when allowed | source/layer/visibility/status enum; coordinate range; public-indexable only for public layer | Soft archive; no hard delete if claimed/verified | community/layer/status, public indexable, geo coarse index | status/location verification changes | Public directory fields only; private layer same-community members |
| `community_reports` | User reports against content/member/map entry. | `report_id uuid` | `community_id`, `reporter_customer_id`, nullable subject FKs or typed subject | `subject_type`, `subject_id`, `reason_code`, `details`, `status`, `created_at`, `resolved_at` | `open`, `triaged`, `actioned`, `dismissed`, `closed` | optional reporter+subject+open dedupe | subject/status/reason enums | No hard delete | community/status/date, subject, reporter/date | append-only report record; moderation events link | Reporter own summary; moderator/admin full |
| `community_moderation_events` | Append-only moderation action history. | `moderation_event_id uuid` | `community_id`, `actor_customer_id`, optional `report_id` | `subject_type`, `subject_id`, `action`, `reason_code`, `note`, `before_status`, `after_status`, `created_at` | append-only | none | action/status enum | No hard delete | community/date, subject, actor/date | this is audit source | Moderator/admin; platform admin |
| `sponsored_placements` | Sponsored campaign/placement separate from organic content. | `placement_id uuid` | optional sponsor/shop/customer reference after product decision | `label`, `placement_type`, `status`, `starts_at`, `ends_at`, `creative_ref`, `approval_status`, timestamps | `draft`, `pending_approval`, `approved`, `active`, `paused`, `ended`, `rejected` | none | `ends_at > starts_at`; label required; status enum | Soft archive | status/date | approval/status changes | Only approved active placements shown |
| `sponsored_placement_communities` | Eligibility join table. | `(placement_id, community_id)` | `placement_id`, `community_id` | `created_at`, optional `approved_by_customer_id` | active by parent placement | PK pair | none | Cascade only if placement deleted before production; otherwise soft via placement | community, placement | approval event | Only eligible community can see placement |

## C. Boundary And Authorization Rules

- Deny by default. No table should expose private rows through broad `using (true)` policies.
- One user can be active in many communities; helpers must evaluate `(customer_id, community_id)` for each row.
- Membership must match the target row `community_id`.
- Community hierarchy does not imply access. Parent membership does not grant child access; child membership does not grant parent access unless a separate membership row exists.
- Group membership requires active parent-community membership first.
- Community roles are separate from Customer/Shop/Rider product roles.
- `merchant` is community-local and does not automatically grant shop ownership or Shop/Rider operational access.
- `pending`, `suspended`, `left`, and `rejected` memberships cannot read protected surfaces.
- Public preview must be through narrow views/RPCs that expose approved fields only, not full-row public SELECT.
- Public directory fields should be explicit allowlists, e.g. name, category, approved public description, coarse/public coordinates as appropriate, and public contact/directions fields.
- RLS helpers should use `SECURITY DEFINER` only when needed to avoid RLS recursion and must set `search_path = public, pg_temp`.

## D. Public/Private Map

### Public Directory Layer

Public directory entries are limited to public places or business/service listings that are owner-approved or community-operator-approved. Public/indexable map rows must not rely on copied provider-owned seed content. Google/provider runtime results remain runtime discovery data unless claim/verification creates MyTree-owned content.

Recommended public exposure is a view/RPC that returns only approved public fields:

- `community_slug`
- `entry_slug`
- display name
- category/subcategory
- approved public description
- public contact/directions fields
- public coordinate or deliberately reduced precision coordinate
- claimed/verified/public status

### Private Member-Only Map Layer

Private entries include community facilities, access notes, resident-visible landmarks, internal pickup/drop-off notes, and local context that is useful to members but not suitable for public indexing. SELECT requires active membership in the exact `community_id`.

### Prohibited Public Exposure

Do not expose member homes, precise resident locations, private activity, private posts, help requests, private events, private groups, or membership data to anonymous/public users.

### Coordinate Precision

When a public listing needs location but exact precision is not appropriate, store exact coordinates in protected columns and expose reduced precision through a public view/RPC. Options include rounding coordinates, using centroid/entrance coordinates, or storing a `location_precision` enum such as `exact`, `entrance`, `block`, `community_centroid`, `hidden`.

## E. Moderation And Audit

- Reactive moderation is the default for ordinary member content.
- High-risk/system-flagged content enters `pending_review`.
- Reports and moderation actions require append-only history.
- Audit records must not be hard-deleted.
- Audit events should capture actor, reason code, timestamps, subject, before status, after status, and minimal note/context.
- Do not store extra personal data in audit rows when stable IDs and status snapshots are enough.
- Membership verification/status changes must create `community_membership_events`.
- Content hide/remove, report triage, and moderation decisions must create `community_moderation_events`.

## F. RLS Policy Matrix

Legend: helper means a `SECURITY DEFINER` function may be needed to avoid RLS recursion over membership tables. Helpers must set `search_path = public, pg_temp`, accept explicit `community_id`, and use `fn_current_customer_id_text()` or a UUID-safe successor to resolve internal `customer_id`.

| Actor | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| Anonymous/public | Public preview views/RPCs only; approved public directory rows only. No direct private table reads. | None. | None. | None. |
| Active member | Member-only surfaces in exact `community_id` via `fn_is_active_community_member(community_id)`. | Posts, reports, help requests, marketplace listings in communities where active. | Own editable content while not hidden/removed, subject to status rules. | No hard delete; owner may soft-close/archive allowed own content. |
| Content owner | Own content plus member visibility. | Same as active member. | Own content fields/status transitions such as edit, close, archive; cannot self-clear moderation status. | Soft delete/archive only; no audit deletion. |
| Group owner | Group rows and group content where also active community member. | Group content/member invites where permitted. | Group metadata and group membership statuses inside owned group; cannot bypass community moderation. | Soft archive group only. |
| Community moderator | All member/moderation surfaces for assigned community. | Moderation events, report triage, possibly official posts/events. | Hide/remove/restore content, update report status, manage non-admin group moderation. | No hard delete; only soft moderation actions. |
| Community admin | Moderator capabilities plus membership verification/status changes and community settings. | Membership events, admin-created groups/events/map entries. | Membership status/roles within community, map approval, sponsored eligibility approval. | No hard delete of audit/membership history; soft archive where allowed. |
| Platform admin | Cross-community governance through explicit platform admin helper/RPC. | Platform-level moderation/admin events. | Emergency moderation, community lifecycle, policy repair. | No hard delete except exceptional governed maintenance outside client RLS. |

### Recommended Helpers

| Helper | Purpose | SECURITY DEFINER? | Notes |
|---|---|---|---|
| `fn_current_customer_id()` | Resolve JWT `customer_id` as UUID. | Possibly no, but centralize parsing. | Must not bind authorization to `line_user_id`. |
| `fn_is_active_community_member(p_community_id uuid)` | Member SELECT/INSERT/UPDATE checks without policy recursion. | Yes. | Reads `community_memberships`; status must equal `active`. |
| `fn_has_community_role(p_community_id uuid, p_roles text[])` | Moderator/admin gates. | Yes. | Active membership plus role in allowed set. |
| `fn_is_active_group_member(p_group_id uuid)` | Group visibility. | Yes. | Must also verify active parent community membership. |
| `fn_can_public_read_map_entry(p_map_entry_id uuid)` | Public directory view/RPC allowlist. | Prefer view/RPC. | Avoid direct public full-row SELECT. |
| `fn_is_platform_admin()` | Platform admin governance. | Yes if reading `platform_admins`. | Avoid broad client access to `platform_admins`. |

### Policy Notes

- Direct policies that query `community_memberships` from `community_memberships` can recurse; prefer helper functions.
- UPDATE policies must include both SELECT visibility and UPDATE `with check` conditions.
- `community_reports` should allow reporter INSERT if active member, but SELECT full report details only for moderators/admins; reporter may see limited own report status.
- Audit tables should generally be INSERT-only through narrow RPC/helper for users/moderators and SELECT-only for authorized moderators/admins.

## G. Sponsored Content

Sponsored content requirements:

- Store sponsored placement records separately from organic posts/map entries.
- Sponsored label is mandatory in data and UI contract.
- Eligibility is explicit through `sponsored_placement_communities`.
- Scheduling requires `starts_at` and `ends_at`.
- Approval/status lifecycle is required before display.
- Sponsored placement must not mutate organic ranking scores.
- Placement may not show in a community unless an active eligibility row exists for that `community_id`.
- Public sponsored listings must obey the same public directory rules; member-only sponsored content must obey membership visibility.

## H. Migration Plan

Do not create migration files in this round. Proposed sequence only:

| Step | Proposed Migration | Dependencies | Rollback/Forward Concern | Validation Query Ideas |
|---|---|---|---|---|
| 1 | Foundation/entities | Live confirmation of `customers(id)`, `platform_admins`, `fn_current_customer_id_text()` or successor, extension availability. | Entity tables are additive; rollback should be forward-fix/drop only before data. | List tables/columns; confirm PKs/FKs/checks; confirm no RLS policies yet expose rows. |
| 2 | Membership and authorization helpers | Step 1; live JWT customer claim behavior. | Function signatures must be stable; dropping old overloads deliberate. | Call helpers as anon/authenticated/admin fixtures; verify active/pending/suspended/left behavior. |
| 3 | Content/groups/map/marketplace | Step 2 helpers; product-approved statuses/enums. | Public/private map fields must be separated before any SEO exposure. | Insert fixture rows; verify group requires community membership; verify public view field allowlist. |
| 4 | Reports/moderation/audit | Steps 1-3; moderation status vocabulary. | Audit tables append-only; avoid triggers that over-capture PII. | Report insert creates report; moderation action creates event; no hard delete grants. |
| 5 | RLS policies and grants | All table/helper definitions. | Highest risk step; policy recursion and admin bypass must be tested. | Anonymous/member/cross-community/moderator/admin SELECT/INSERT/UPDATE/DELETE matrix. |
| 6 | Validation/backfill/contract checks | Steps 1-5; seed fixtures or staging data. | Backfills must not infer membership from LINE or shop ownership without approval. | Count orphan FKs; verify denied cross-community reads; explain policy plans; run migration lint. |

## I. Open Decisions

### Blocker Before Creating Migration

- Retrieve and review the Lane 3 migrations `20260910120000_rider_close_job_backend_foundation.sql` and `20260910123000_rider_delivery_detail_contract.sql`.
- Confirm the canonical Worker repository migration head and choose a migration owner for Community Phase 3.
- Confirm live schema for `customers`, `platform_admins`, `shop_staff`, `moderation_reports`, Rider/Delivery V3 event tables, and any existing auth helpers.
- Decide whether to introduce enum types or text CHECK constraints for community roles/statuses.
- Decide exact public directory field allowlist and coordinate precision policy.
- Decide whether community admin assignment is self-managed by platform admin only or can be delegated by existing community admins.

### Can Decide Later

- Richer group roles beyond owner/member/moderator.
- Category taxonomies for posts, help requests, marketplace, and map entries.
- Whether events need RSVP tables in the first implementation.
- Whether marketplace needs chat/contact tables or only external contact in first slice.
- Public SEO URL strategy beyond approved directory/community pages.

### Must Check Live DB

- Actual RLS enabled state for referenced tables.
- Existing function volatility/security/search-path settings.
- Existing `moderation_reports` structure and whether it should be replaced or bridged.
- Existing storage policies if community media uploads are added.
- Existing admin bypass/GUC behavior, if any.
- Staging vs production divergence, especially after Rider backend Lane 3 work.
