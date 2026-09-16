# Community Phase 3 Data Contract

Status: planning contract only. Do not treat this as an applied schema.

## TypeScript Contract

The first scaffold is represented in `src/lib/communityPhase3.ts`.

`src/lib/communityPhase3.contract-check.ts` is a compile-time contract-check module. It is included by TypeScript build checks, but it is not an automated runtime test because this repository does not currently include a test runner.

Current contracts:

- `CommunityDefinition`
- `CommunityMembership`
- `CommunitySection`
- `CommunityNavigationItem`
- `CommunityMembershipScope`

These types are intentionally schema-shaped but not schema-bound. They define the vocabulary the UI can use while the database owner prepares a reviewed migration later.

## Identity Rule

`customer_id` remains the internal identity anchor. LINE may authenticate or distribute the experience, but community membership must not be keyed only by LINE identity.

## Core Entities For Next DB Round

Proposed future tables or read models:

```text
communities
community_memberships
community_groups
community_group_memberships
community_posts
community_events
community_help_requests
community_marketplace_listings
community_map_entries
community_moderation_events
```

No migration is created in this round. The next schema round must check the latest timestamp in `supabase/migrations` first and coordinate with Rider backend migrations.

`community_groups` and `community_group_memberships` are separate group/club entities under `community_id`. They are not nested communities. Community hierarchy is reserved for geographic or organizational boundaries.

## Community Membership Requirements

`community_memberships` should support:

- `customer_id`
- `community_id`
- role: resident, guardian, worker, merchant, moderator, admin
- status: active, pending, suspended, left
- relationship label: home, work, school, merchant, other
- verification source and timestamp
- audit timestamps

A user may have multiple active memberships. Authorization checks must evaluate the target community, not a single global current community.

The `merchant` role is a community-local role. It must not automatically grant Shop ownership or Shop/Rider operational permissions.

## Content Requirements

Every private content record should include:

- `community_id`
- author/customer reference where applicable
- visibility
- moderation status
- created/updated timestamps
- soft-delete or archival fields where history matters

Help requests, marketplace listings, and group posts may need additional state machines in later specs. They should not reuse ordering, cart, or delivery state contracts.

General member content can publish immediately within its authorized community boundary. Reports and reactive moderation remain required. System-flagged risky content should enter `pending_review`.

Append-only audit is required from day one for membership verification/status changes, reports, moderation actions, and content hide/remove actions.

## Community Map Requirements

`community_map_entries` should support MyTree-owned and community-verified records without mixing them with provider-owned seed results.

Community Map has two data layers:

- Public directory layer for public places and business/service listings approved by an owner or community operator.
- Private member-only map layer for member-visible community facilities, access notes, and local context.

Do not public-index member homes, precise resident locations, private posts, help requests, private events, private groups, or membership data.

Required provenance fields for a later design:

- source type: MyTree-owned, community-verified, provider-runtime
- claimed/verified state
- allowed external place reference where policy permits
- location confidence and verifier
- visibility/indexability flag
- attribution metadata when required
- eligible community ids for sponsored placements

Provider-runtime results should remain runtime discovery data unless a claim/verification flow creates MyTree-owned data.

Sponsored content must be stored separately from organic content, clearly labeled, scoped to eligible `community_id` values, and prevented from silently altering organic ranking.

## Authorization Requirements

Future RLS/Worker policy must enforce:

- active membership for member-only reads;
- moderator/admin role for moderation actions;
- author or role permission for edits;
- no private cross-community leakage;
- no hidden frontend-only authorization shortcuts.
Unknown or unsupported visibility values must deny access by default.

## Open DB Questions For Next Round

- Which repository owns the canonical Community Phase 3 migration timestamp?
- Should groups/clubs be nested communities or a separate sub-boundary table?
- Which community surfaces require append-only event history from day one?
- What moderation states are needed before the Sammakorn pilot?
- Which Community Map records are public/indexable in the first SEO slice?
