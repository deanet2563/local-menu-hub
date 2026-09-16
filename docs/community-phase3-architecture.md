# Community Phase 3 Architecture

Status: scaffold and documentation only. No database migration is introduced in this round.

## Scope

Community Phase 3 starts with a Sammakorn-first pilot while keeping the model ready for multiple communities per user. A customer may belong to separate circles such as home, work, school, and merchant communities. Each community has its own membership boundary and default visibility.

This round creates the route namespace, placeholder UI, and TypeScript contracts needed to discuss the data model safely before schema work starts.

## Route Namespace

Initial public entry:

```text
/community
```

Planned child surfaces:

```text
/community/:communitySlug/feed
/community/:communitySlug/posts
/community/:communitySlug/events
/community/:communitySlug/help-requests
/community/:communitySlug/marketplace
/community/:communitySlug/groups
/community/:communitySlug/map
```

Only `/community` is registered in this scaffold. Child links are placeholders until the database contract and authorization boundary are approved.

## Hierarchy

The Phase 3 hierarchy is:

```text
community
  -> optional parent community
  -> membership
  -> community surfaces
  -> content records scoped by community_id
  -> optional group/club sub-boundaries
```

Sammakorn is the first top-level community. Future communities must not reuse Sammakorn-specific IDs or assumptions. Parent/child communities may later support village zones, schools, workplace campuses, or building clusters.

## Membership

Membership is the authorization anchor for private community surfaces. A user can have many memberships:

```text
customer_id
community_id
role
status
relationship_label
```

Example relationships:

- `home`
- `work`
- `school`
- `merchant`
- `other`

Only active memberships should unlock member-only surfaces. Pending, suspended, and left memberships must not authorize private feed, posts, help requests, marketplace, events, or groups.

## Visibility

Community visibility follows "วงใครวงมัน":

- Public preview: safe discovery surfaces such as a community map entry or landing preview.
- Member-only: feed, posts, events, help requests, marketplace, groups, and most local updates.
- Moderator-only: moderation queues, reports, admin actions, and future governance tools.

Visibility must be enforced by backend/RLS in the schema round. Frontend state is only display logic and must not be treated as authorization truth.

## Community Map Boundary

Community Map remains deterministic. MyTree-owned or community-verified records must stay separate from provider-derived runtime seed data. Google-sourced unclaimed results are not durable MyTree merchant records and must not become indexable copied listing pages.

The `/community` scaffold can point users toward Community Map, but any future map implementation must preserve:

- MyTree-owned vs provider-derived provenance.
- Claimed/verified vs unclaimed visual distinction.
- Provider attribution/caching rules.
- Public SEO access for owned community pages where allowed.

## Authorization Boundaries

Backend/server truth is authoritative. Future writes must validate:

- authenticated internal `customer_id`;
- active membership in the target `community_id`;
- role permission for the target action;
- content visibility and moderation state;
- group/club membership when a sub-boundary exists.

The frontend must never bypass RLS or infer authorization only from local navigation state.

## Non-Goals For This Round

- No Supabase migration.
- No Worker endpoint.
- No production deploy.
- No Customer ordering/cart/order contract change.
- No Rider Native or Rider backend change.
- No provider data ingestion.
