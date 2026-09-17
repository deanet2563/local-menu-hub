# Community Phase 3 UX Round 2 QA Contract

Status: frontend prototype verification only. This round uses typed fixtures and does not connect to Supabase, Worker, LINE authentication, or any external API.

## Automated QA Baseline

The repository does not currently include Vitest, Jest, Playwright, Cypress, or another runtime test runner. No dependency is added in this round.

`src/lib/communityPrototype.contract-check.ts` is a compile-time contract-check module. It verifies that fixture lifecycle fields and the deny-by-default detail lookup remain type-safe, but it is not an automated runtime test. Runtime route and interaction checks must be executed in a browser until a test framework is approved.

## Required Route Checks

For each detail route, verify list link, detail content, back link, invalid ID, community mismatch, mobile overflow, keyboard focus, and disclosure text:

| Surface | Valid fixture | Detail route |
| --- | --- | --- |
| Feed | `post-pinned-safety` | `/community/feed/post-pinned-safety` |
| Groups | `group-yoga` | `/community/groups/group-yoga` |
| Events | `event-cleanup` | `/community/events/event-cleanup` |
| Help | `help-lost-key` | `/community/help/help-lost-key` |
| Marketplace | `market-free-books` | `/community/marketplace/market-free-books` |
| Map | `map-cafe` | `/community/map/map-cafe` |

Invalid IDs must render the not-found state without throwing. Changing the switcher away from `sammakorn` on a valid detail must render the locked cross-community state and must not continue showing the old detail body.

## Lifecycle Matrix

| Domain | Required fixture states |
| --- | --- |
| Post | `published`, `pending-review`, `removed` |
| Group | `open-to-community`, `private`, `locked` |
| Event | `open`, `full`, `cancelled`; privacy separately labels member-only/private-group |
| Help request | `open`, `in-progress`, `resolved` |
| Marketplace | `active`, `reserved`, `sold` |
| Map | `public-approved`, `private-approximate`, `unavailable` |

## Privacy Checks

- Private group details show safe metadata and a locked panel; internal description and actions stay hidden.
- Help and private map fixtures use shared-area or approximate labels only.
- Exact-location wording is allowed only when a public directory fixture is `public-approved` and `exactLocationOptIn` is true.
- Public location is never derived from a private map fixture.
- Removed post details do not reproduce removed content.

## Resilient State Checks

- Loading uses `role="status"`, `aria-live="polite"`, and `aria-busy`.
- Empty states appear when the selected community has no fixtures.
- The unavailable map fixture renders an error state; retry changes local presentation only and explicitly says it does not contact a server.
- Locked and not-found states contain text labels and do not rely on color.
- Backend-dependent actions remain disabled and say `ยังไม่เปิดใช้งานในหน้าทดลอง`.

## Release Candidate Gate Remaining

- Adopt a runtime browser test framework and automate this matrix.
- Run physical-phone testing after the Release Candidate preview is available over HTTPS.
- Replace fixture authorization demonstrations with reviewed backend/RLS enforcement only in a separately approved backend round.
