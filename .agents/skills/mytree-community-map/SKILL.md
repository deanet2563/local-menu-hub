---
name: mytree-community-map
description: Use for Community Map, Google Places seed/discovery, claimed or verified listings, geolocation, nearby ranking, SEO/indexability, map data ownership, attribution, caching, and external-place ingestion rules.
---

# MyTree Community Map

## Product model

Community Map is a MyTree community/discovery surface. External providers may seed discovery, but MyTree-owned records remain distinct from provider-owned data.

## Canonical data rules

- Google-sourced unclaimed businesses are discovery/map seed data only.
- A Google result does not become a MyTree merchant record until Claim/signup/verification according to the Bible.
- Keep `google_place_id` or equivalent external reference only where allowed and useful.
- Claimed MyTree merchants may have MyTree-owned pages and indexable content.
- Community/verified listings that MyTree legitimately owns may be indexable.
- Do not scrape/copy provider business data into permanent MyTree records in violation of provider terms.
- Respect current attribution, caching, storage, display, and API usage policies.

## Required workflow

1. Read the Bible and latest Community Map decision/addendum.
2. Identify whether each field is MyTree-owned, user-submitted, community-verified, or provider-derived.
3. Verify current provider documentation before implementing storage/caching/SEO behavior.
4. Keep runtime discovery data separate from persistent merchant/listing ownership.
5. Preserve public SEO access; do not force public merchant/community pages behind LINE login.
6. For location ranking, inspect permission, stale-location, denied-location, and fallback behavior.

## QA matrix

Check map-empty seed behavior, claimed/unclaimed visual distinction, attribution, duplicate matching, claim transition, location denied, stale location, nearby ordering, small mobile viewport, and SEO/indexability rules.

## Stop conditions

Stop if provider policy is unclear, if implementation requires copying restricted data into MyTree-owned records, or if claim/ownership boundaries are ambiguous.

## Completion report

State data provenance, storage/caching rule, attribution requirement, SEO status, provider docs consulted, files/data objects touched, and verification evidence.