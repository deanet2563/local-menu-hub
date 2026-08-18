# MyTree.cc — Project Bible

**Status snapshot:** 2026-08-18  
**Pilot:** Sammakorn Village, Ramkhamhaeng 110/112, Bangkok

This document is the current product/architecture sequencing source of truth for MyTree unless a later approved Bible decision supersedes it.

---

## 1. Product direction

MyTree is a hyperlocal community commerce platform. Food ordering and rider delivery are the first transactional layers, but the long-term product is a digital layer for the physical community: residents should be able to discover nearby shops, services, offers and useful local resources, while local businesses gain a low-cost channel to be discovered and transact.

Core principles:

- Low/no commission model; do not reproduce high-GP marketplace economics.
- LINE OA/LIFF remains an important Phase-1 distribution and identity surface for Thailand.
- `customer_id` remains the internal identity anchor rather than binding core data directly to LINE.
- COD / shop QR remain per-shop. MyTree does not hold delivery-fee money.
- AI is an operational leverage layer, not the source of truth for deterministic business rules.

---

## 2. Hard constraints

1. Do not weaken authorization, RLS, guard triggers or admin approval gates for AI convenience.
2. No unrestricted LLM database writes. AI actions must go through controlled tools/RPCs/Worker APIs with least privilege and auditability.
3. No passenger transport for general riders. Passenger capability must remain limited to properly verified rider classes and legal review.
4. Never hard-delete shops/riders when order-history integrity would be damaged; use governed deactivation/ban flows.
5. No hidden pay-to-win search. Sponsored placement must be separate from organic recommendation.
6. Do not create duplicate source-of-truth shop/location tables for Community Map.

---

## 3. Current source architecture and corrections

- Frontend: `deanet2563/local-menu-hub`
- Backend Worker: `deanet2563/mytree-worker`
- Database: Supabase/Postgres with RLS and SECURITY DEFINER helpers
- Hosting: Cloudflare Pages + Cloudflare Worker
- Messaging/Auth: LINE OA + LINE Login + LIFF

Older handoff material said `mytree-worker` was local-only and that migrations did not exist. That is no longer true as of 2026-08-16:

- `deanet2563/mytree-worker` exists in GitHub.
- `supabase/migrations/` exists in both repositories.
- Rider-related migrations currently exist across both repositories.

### Technical debt — canonical migration ownership

Before another schema-heavy feature, choose **one canonical production Supabase migration owner/location**. Community Map and AI schemas must follow that canonical history instead of growing two independent migration histories.

---

## 4. Current implementation status — 2026-08-16

Core ordering, shop management, customer order tracking, per-shop payment handling, menu management and role-based LINE flows are already implemented.

### Rider V2 — integration/regression stabilization

Recent merged work includes:

- Nearby Rider candidate/offer flow.
- Trusted Rider candidate endpoint and push integration.
- Delivery distance + delivery fee snapshot structure.
- Shop delivery-fee payer control.
- Checkout capture of the actual delivery coordinates.
- Persistence of checkout delivery point for downstream distance/fee calculations.
- Security-definer corrections for Rider V2 RPCs.

**Decision:** Rider V2 is now in integration/regression stabilization. Do not interrupt this gate with a large new transactional rewrite.

---

# 5. Community Map — Core Feature Decision

**Decision date:** 2026-08-16  
**Status:** APPROVED  
**Working name:** **MyTree Community Map**

## 5.1 Purpose

Community Map is a core local discovery and marketing layer for both sides of MyTree.

For residents/buyers:

- Discover nearby shops and services from their real location.
- Find food, cafes, home services, health, pet, shops and future community resources.
- See open/closed state and distance.
- Enter existing MyTree shop/order flow from a map pin.
- Open Google Maps for real directions/navigation.

For merchants/service providers:

- Obtain discoverable local presence even if they do not use MyTree ordering.
- Receive a basic map listing during the free pilot.
- Convert discovery into shop views, orders, calls/contact or directions.
- Later use premium listing/discovery tools without high GP commission.

## 5.2 Architecture

Use a **real Google Maps geographic basemap**, not a hand-drawn village map.

Google handles:

- map geography and roads
- coordinates / projection
- pan / zoom
- geographic basemap
- navigation handoff

MyTree handles:

- branded map styling
- MyTree custom pins/markers
- shop/service data
- categories
- search/discovery
- open-now state
- near-me filtering
- shop preview bottom sheet
- order/contact/directions actions
- later promotions/featured systems

MyTree must not recreate turn-by-turn navigation. `Directions` hands destination coordinates to Google Maps.

## 5.3 Data-source rule

**Do not create a parallel `map_shops` source of truth.**

Use the existing `shops` domain and existing location fields such as `lat`, `lng` and address data. Extend the domain only through reviewed migrations.

Candidate extensions, subject to schema review:

- `category`
- `subcategory`
- `short_description`
- `map_visible`
- `location_verified_at`
- `location_source`
- `featured_until` (future monetization only)

Promotions should remain a separate domain/table instead of overloading `shops`.

## 5.4 Shop location verification

Free-text address alone is not enough for a trusted pin.

Recommended flow:

```text
Shop information
  -> search/enter address or place
  -> show real map
  -> owner places/confirms pin
  -> capture lat/lng
  -> validate completeness/range
  -> save
  -> verification policy
  -> eligible for Community Map
```

For the Sammakorn pilot, manual admin verification is acceptable and preferred over premature automation.

## 5.5 Community Map MVP

1. Google basemap centered on Sammakorn pilot area.
2. Modern MyTree custom map style.
3. Approved + active + map-visible shop pins.
4. Category filters.
5. Search across MyTree shop/menu/service data.
6. `Near me` using user location after permission.
7. Distance from user to shop.
8. Open/closed state.
9. Marker clustering when required.
10. Shop preview bottom sheet.
11. `View shop` action.
12. `Order` action for ordering-enabled shops.
13. `Call / Contact` for applicable non-ordering listings.
14. `Directions` handoff to Google Maps.
15. Mobile-first LIFF/browser behavior.

Explicitly out of MVP:

- Full navigation engine.
- Paid ranking system.
- LLM-dependent recommendation engine.
- Automatic ingestion/scraping of every Google Maps business into MyTree.
- Bangkok-wide expansion before Sammakorn data quality is proven.

## 5.6 UX principles

- Map is a discovery surface, not a clone of Google Maps.
- Mobile UI combines map + results/bottom sheet rather than forcing all interaction through pins.
- Pins use one coherent MyTree visual system.
- Selected pins may enlarge/highlight.
- Dense areas use clustering.
- Search results and map viewport stay synchronized.
- Sponsored content, if introduced, must be clearly labeled and separated from organic results.

## 5.7 Monetization direction

Pilot basic listing is free.

Later premium may include enhanced profiles, richer media, promotion publishing, member offers, merchant analytics and clearly labeled sponsored discovery. Premium must not change MyTree's low/no-GP principle.

## 5.8 Community Map Seed Strategy — APPROVED 2026-08-18

Use **Google Places as a discovery/seed layer** so the Sammakorn Community Map does not launch empty. Google-sourced businesses are discovery results only and are **not MyTree merchant records** until the business is claimed/registered and its information is confirmed through MyTree.

### Seed-layer rules

- Google Places may be queried at runtime to surface nearby businesses around the active Community Map area.
- MyTree must not bulk-copy or permanently ingest Google Places content as if it were MyTree-owned merchant data.
- `google_place_id` may be stored as the external reference/bridge between a Google place and a future MyTree listing, subject to the current Google Maps Platform terms and policies at implementation time.
- Google-sourced content must follow the then-current runtime, caching, display and attribution requirements of Google Maps Platform.
- Before implementation or a material API upgrade, engineering must re-check the current Google Maps Platform / Places policies rather than relying on an old assumption in this Bible.
- Google-sourced discovery results must be visually distinguishable from MyTree verified/claimed listings.
- A Google result becoming visible on MyTree does not imply partnership, verification or merchant membership.

### Recommended lifecycle

```text
Google Places discovery result
        ↓
Displayed on Community Map as external/unclaimed discovery
        ↓
Merchant chooses Claim / Register
        ↓
MyTree verifies identity/location and collects MyTree-owned business data
        ↓
Create/link MyTree merchant/listing
        ↓
Store google_place_id as external reference when useful
        ↓
MyTree-owned data becomes source of truth for the claimed listing
```

### Empty-map prevention without contaminating MyTree data

The map may therefore contain two clearly separated discovery classes during the pilot:

1. **Google-sourced / unclaimed discovery pins** — runtime discovery layer; not a MyTree merchant.
2. **MyTree claimed / verified pins** — MyTree listing backed by MyTree-owned or merchant-provided data.

This design lets Community Map feel useful from day one while allowing MyTree's own local business graph to grow organically through merchant acquisition and community verification.

## 5.9 Community Map SEO / Indexing Strategy — APPROVED 2026-08-18

The SEO layer and Google Places seed layer are intentionally separated.

### Indexing policy

**Google-sourced unclaimed shop → Map display only; do not create an indexable SEO landing page from Google-sourced content.**

**Claimed / MyTree merchant → May have an indexable MyTree page once MyTree has merchant-provided/verified content sufficient to make the page genuinely MyTree-owned and useful.**

**Community / verified listing using MyTree-owned data → May be indexable when the listing meets MyTree data-quality and verification requirements.**

### SEO architecture direction

Interactive map experience:

```text
mytree.cc/map
  -> interactive Community Map
  -> Google basemap + seed discovery + MyTree pins
  -> primarily UX/discovery
```

Indexable local-discovery layer:

```text
mytree.cc/{community}
mytree.cc/{community}/{category}
mytree.cc/shop/{slug}
```

These indexable pages should be built from **MyTree-owned / merchant-provided / verified community content**, not copied Google Places content.

Potential page classes include:

- Community landing page, e.g. Sammakorn.
- Category landing pages, e.g. food, cafe, services.
- Claimed merchant/shop pages.
- Verified community listings when enough original/useful MyTree information exists.

### SEO implementation requirements

- Public pages intended for search must be crawlable and not require LINE login merely to view basic public information.
- Favor SSR, static generation, pre-rendering or another crawl-friendly rendering strategy for SEO-critical pages rather than depending entirely on client-only map rendering.
- Use canonical URLs and clean stable slugs.
- Use appropriate structured data for eligible MyTree-owned business pages after validating against current Google Search documentation at implementation time.
- Avoid thin, duplicate or programmatically generated pages that add no original MyTree value.
- Search indexing must never be used as a reason to persist Google Places content beyond what the applicable platform terms allow.

### Strategic funnel

```text
Google Search / social / QR / direct traffic
        ↓
MyTree community/category/shop SEO page
        ↓
Community Map / Shop profile
        ↓
Order / Contact / Directions / Claim
        ↓
Merchant acquisition + customer activity
```

Community Map therefore serves two separate growth mechanisms:

1. **Seed/discovery growth:** Google Places prevents an empty map and helps users find useful nearby businesses from launch.
2. **Owned SEO growth:** claimed and verified MyTree content builds MyTree's own indexable local-search footprint over time.

---

# 6. Hybrid AI Co-work Network — Architecture Decision

MyTree will use a **provider-agnostic Hybrid AI Co-work Network** rather than coupling the platform to one model/vendor.

```text
                           MyTree
                              |
                    AI Gateway / Orchestrator
                              |
            +-----------------+-----------------+
            |                 |                 |
       Rules / SQL      Qwen / Self-hosted    OpenAI
      deterministic     routine / volume      cloud intelligence
            |                 |                 |
            +-----------------+-----------------+
                              |
                     Controlled Tool/API Layer
                              |
                    Worker / RPC / RLS / Guards
                              |
                           Supabase
                              |
                   high-impact action
                              |
                        Human approval
```

## 6.1 Routing

1. **Rules / SQL first** for deterministic validation, calculations, pricing rules and status transitions.
2. **Qwen / self-hosted** for repetitive, high-volume, privacy-sensitive, classification, extraction, summarization, FAQ and monitoring work once measured load justifies infrastructure.
3. **OpenAI economical model** for general cloud AI when API economics are better than keeping GPU infrastructure online.
4. **OpenAI advanced reasoning/coding** for complex reasoning, coding, debugging, architecture, incidents, exceptions and high-value decisions.
5. **Human approval** for privileged, legal, financial, safety-sensitive, governance or destructive actions.

## 6.2 Security

- AI never receives unrestricted direct production DB write access.
- Every action goes through a controlled tool layer.
- Tools require explicit permission scope, validation, audit logs and cost/rate controls.
- Approve/ban, payment-state changes, destructive changes and privileged account changes are not autonomous LLM actions.
- Provider interfaces remain replaceable so Qwen/OpenAI can be switched without rewriting business flows.

## 6.3 Implementation stages

### Stage A — START NOW, in parallel with Rider stabilization

Foundation only:

- AI Gateway/provider interface.
- Provider routing contract.
- Tool registry conventions.
- AI task schema.
- Audit event schema.
- Confidence/escalation fields.
- Cost/token/latency measurement.
- Read-only access patterns.
- Human approval pattern.

Do **not** insert AI into ordering, payment, rider fee calculation or rider state transitions.

### Stage B — after Rider V2 regression gate is green

Build first production coworker: **MyTree Ops Coworker**.

Initial responsibilities:

- Read operational state through approved tools.
- Detect incomplete/stuck/unusual workflow states.
- Summarize incidents.
- Flag problems for humans.
- Prepare support/admin drafts.

Example initial tools:

- `flag_problem()`
- `create_incident_summary()`
- `prepare_support_draft()`
- safe read-only order/shop/rider status tools

No autonomous production-state repair in V1.

### Stage C — Sammakorn pilot operations

Add low-risk coworkers:

- Support L1.
- Shop onboarding assistant.
- Menu/data cleanup assistant.
- FAQ assistant.
- Classification/tagging assistant.
- Community Map listing/data-quality assistant.

Measure task volume, token usage, latency, accuracy, escalation rate, human correction rate and cost per resolved task.

### Stage D — growth / measured utilization

A/B test Qwen/self-hosted on low-risk high-volume workloads. Move workloads only when measured economics, privacy, latency or control make it worthwhile. Keep advanced cloud reasoning as escalation.

---

# 7. Community Map + AI relationship

**Community Map MVP must not depend on AI.**

Deterministic map functions stay normal software:

- coordinates
- distance
- category filtering
- open/closed state
- viewport filtering
- map visibility
- directions links
- approval/ban state

AI can later assist with merchant description/category cleanup, missing-data detection, tag suggestions, onboarding drafts, listing-quality monitoring and natural-language discovery after deterministic search is proven.

This keeps launch auditable and prevents AI infrastructure from blocking Community Map.

---

# 8. Approved execution sequence

## Gate 0 — Finish Rider V2 stabilization (NOW)

Verify end-to-end:

- checkout delivery coordinate capture
- persisted delivery location snapshot
- delivery distance calculation
- delivery fee snapshot
- delivery fee payer behavior
- nearby rider candidate flow
- push/receipt behavior where enabled
- rider/shop/customer authorization
- RLS + SECURITY DEFINER regression
- COD/QR ordering remains unaffected
- no passenger behavior for unqualified riders

Also choose the canonical Supabase migration owner/location.

## Lane A — AI Foundation (START NOW, SMALL PARALLEL TRACK)

Start Stage A immediately because it is architectural and low-risk. Do not build business-critical autonomous agents yet.

## Gate 1 — Rider V2 regression green

Then begin two tracks in parallel:

### Product track — Community Map MVP

Community Map becomes the next major customer/merchant growth feature because MyTree already has shop/location foundations.

### AI track — MyTree Ops Coworker V1

Start the first read-only production coworker after the same Rider gate. It can observe pilot operations and surface data/flow problems without changing transactional state.

## Gate 2 — Sammakorn internal pilot

Pilot Ordering + Rider + Community Map together with controlled merchants/users. Instrument operations and data quality.

## Gate 3 — AI-supported pilot operations

Add Support L1, onboarding/data cleanup, FAQ and Community Map listing-quality assistants.

## Gate 4 — Premium / growth

Only after measured adoption:

- merchant premium listing/profile features
- promotions/member offers
- clearly labeled sponsored discovery
- separately approved Rider premium/subscription features
- Qwen self-hosting when utilization proves the economics

---

# 9. Immediate next work order

1. Close Rider V2 regression gate.
2. Choose one canonical migration history.
3. Create AI Gateway Stage-A skeleton — no autonomous writes.
4. Prepare Community Map technical spec + UX prototype.
5. Implement shop location verification needed for map data quality.
6. Implement Community Map Seed Strategy with Google Places as runtime discovery only and clear external/unclaimed labeling.
7. Build Community Map MVP.
8. Build crawlable MyTree community/category/claimed-listing SEO pages from MyTree-owned/verified data only.
9. Build MyTree Ops Coworker V1 read-only in parallel once Rider gate is green.
10. Run Sammakorn pilot and measure adoption, merchant claims, data quality, operations and cost.

**This sequence is the approved roadmap until a later Bible decision supersedes it.**
