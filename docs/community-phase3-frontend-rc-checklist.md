# Community Phase 3 Frontend RC Checklist

Status: fixture-only frontend hardening. This document does not authorize deployment, backend integration, database work, or migration creation.

## Route Inventory

| Surface | List route | Detail route |
| --- | --- | --- |
| Home | `/community` | Not applicable |
| Feed | `/community/feed` | `/community/feed/$postId` |
| Groups | `/community/groups` | `/community/groups/$groupId` |
| Events | `/community/events` | `/community/events/$eventId` |
| Help requests | `/community/help` | `/community/help/$requestId` |
| Marketplace | `/community/marketplace` | `/community/marketplace/$listingId` |
| Map | `/community/map` | `/community/map/$entryId` |

All Community screens load through the Community lazy-route wrapper. The generated route tree remains the URL registration source of truth.

## Lifecycle Matrix

| Domain | Required states |
| --- | --- |
| Posts | `published`, `pending-review`, `removed` |
| Groups | `open-to-community`, `private`, `locked` |
| Events | `open`, `full`, `cancelled`; member-only/private-group is shown separately |
| Help requests | `open`, `in-progress`, `resolved` |
| Marketplace | `active`, `reserved`, `sold` |
| Map | `public-approved`, `private-approximate`, `unavailable` |

## Privacy Gate

- Detail lookup requires both the fixture ID and matching `communityId`; mismatches are denied.
- Private groups without fixture access show safe metadata and a locked state, not internal content or actions.
- Removed posts return a removal explanation rather than the removed body.
- Private map entries return an approximate area or unavailable state and never expose an exact location.
- Exact map location wording is allowed only for a public-directory entry that is approved and explicitly opted in.
- Help-request fixtures use shared-area labels and contain no resident address or precise coordinate.
- Marketplace is an independent Community surface and does not import Food Order, cart, or order contracts.
- The visible disclosure must remain: `หน้าทดลอง MyTree Community — ข้อมูลทั้งหมดเป็นตัวอย่างและไม่มีการบันทึกข้อมูลจริง`.

## Automated Tests

Run:

```powershell
node --test src/lib/communityPrototype.runtime.test.mjs
```

The runtime suite covers navigation order, valid/invalid/cross-community lookup, locked groups, removed-post redaction, map precision rules, lifecycle labels, Marketplace separation, approved disclosure text, and Community route lazy-loading. The existing TypeScript contract-check module remains compile-time coverage and is not described as a runtime test.

## Accessibility Gate

- Skip link focuses `#community-main` after activation.
- The loaded screen contains one `<main>` landmark; the lazy fallback also contains one standalone `<main>` while content is pending.
- Exactly one navigation item has `aria-current="page"` on list and detail routes.
- The community name is the page `h1`; card/detail and nested state headings preserve hierarchy.
- Loading, empty, and not-found states use polite status announcements; error and locked states use alerts.
- Interactive controls use visible focus rings, accessible names, and a minimum height of approximately 44 pixels.

## Visual And Phone Gate

Required viewports are `320x568`, `360x800`, `390x844`, `768x1024`, and `1440x900`.

- Confirm page-level `scrollWidth === clientWidth` on every list and detail route.
- Confirm the horizontal Community navigation does not widen the page and the active item is visible.
- Confirm Thai headings, badges, descriptions, prices, and disabled-action labels wrap without clipping.
- Confirm content remains reachable above the bottom edge and no fixed element obscures actions.
- Repeat the final mobile gate on a physical phone after an HTTPS Release Candidate preview exists.

## Build And Bundle Gate

Round 2 baseline: one initial JavaScript chunk, `904,070 bytes` uncompressed.

Round 2.1 result after Community route-level lazy loading:

| Chunk | Uncompressed size |
| --- | ---: |
| Initial application JS | 865,828 bytes |
| Community shell/shared data | 33,453 bytes |
| Community detail | 7,055 bytes |
| Community list surface | 1,056 bytes |

Community is no longer included in the initial customer JavaScript path beyond the small lazy-route wrapper. The existing application-wide chunk-size warning remains visible and is not hidden by configuration.

## Public Preview Plan

1. Create an HTTPS branch preview from the reviewed RC commit only after explicit deployment approval.
2. Use the existing public Supabase URL and anonymous key only for application bootstrap; do not add service-role credentials or fixture persistence.
3. Keep the Community DEV bypass disabled on the public hostname. Add a separately reviewed fixture-only preview access mechanism if the hosting environment still requires LINE authentication.
4. Run route, privacy, copy, accessibility, network, mobile, and physical-phone checks against the preview URL.
5. Verify no Community action sends a request and no Community route redirects to LINE, Supabase mutation endpoints, or Worker mutation endpoints.
6. Record the preview commit and URL; do not promote it to production during this gate.

## Known Limitations

- No browser automation framework is installed; DOM interaction and responsive checks remain manual/browser-assisted.
- The current Windows headless browser enforces a minimum CSS viewport and crops nominal `320x568`, `360x800`, and `390x844` captures. Those files are diagnostic only and do not satisfy the exact mobile acceptance gate.
- Fixture authorization demonstrates intended presentation only and is not a substitute for reviewed RLS/backend enforcement.
- Physical-phone verification remains pending until an approved HTTPS RC preview exists.
- The main application bundle still exceeds the existing Vite warning threshold for reasons outside Community scope.

## Rollback Procedure

1. Disable or remove the branch preview without changing production deployment state.
2. Revert the single Round 2.1 frontend commit on the feature branch; do not rewrite or amend earlier commits.
3. Rebuild and verify that the seven list routes and six detail routes return to the prior Round 2 behavior.
4. Confirm no database rollback is needed because this round creates no migration, schema, Worker, or stored-data change.
