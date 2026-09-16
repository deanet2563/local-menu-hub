# Community Phase 3 Data Contract

Status: planning contract only. Do not treat this as an applied schema.

## TypeScript Contract

The first scaffold is represented in `src/lib/communityPhase3.ts`.

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

## Content Requirements

Every private content record should include:

- `community_id`
- author/customer reference where applicable
- visibility
- moderation status
- created/updated timestamps
- soft-delete or archival fields where history matters

Help requests, marketplace listings, and group posts may need additional state machines in later specs. They should not reuse ordering, cart, or delivery state contracts.

## Community Map Requirements

`community_map_entries` should support MyTree-owned and community-verified records without mixing them with provider-owned seed results.

Required provenance fields for a later design:

- source type: MyTree-owned, community-verified, provider-runtime
- claimed/verified state
- allowed external place reference where policy permits
- location confidence and verifier
- visibility/indexability flag
- attribution metadata when required

Provider-runtime results should remain runtime discovery data unless a claim/verification flow creates MyTree-owned data.

## Authorization Requirements

Future RLS/Worker policy must enforce:

- active membership for member-only reads;
- moderator/admin role for moderation actions;
- author or role permission for edits;
- no private cross-community leakage;
- no hidden frontend-only authorization shortcuts.

## Open DB Questions For Next Round

- Which repository owns the canonical Community Phase 3 migration timestamp?
- Should groups/clubs be nested communities or a separate sub-boundary table?
- Which community surfaces require append-only event history from day one?
- What moderation states are needed before the Sammakorn pilot?
- Which Community Map records are public/indexable in the first SEO slice?
