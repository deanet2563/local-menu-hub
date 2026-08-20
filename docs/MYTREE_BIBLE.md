# MyTree.cc — Project Bible

**Status snapshot:** 2026-08-20  
**Pilot:** Sammakorn Village, Ramkhamhaeng 110/112, Bangkok  
**Role:** Current product / architecture / execution sequencing source of truth. A later approved Bible decision supersedes an older one.

---

# 1. North Star — MyTree as a Daily Local Life Platform

MyTree begins with food ordering and local delivery, but the long-term product is **not a food-delivery app**. The goal is to become a **Daily Local Life / Community Commerce Platform** that residents can use repeatedly for nearby food, shops, services, promotions, community discovery and useful local information.

MyTree should connect the physical community to a useful digital layer:

- residents discover what is nearby and useful today;
- food merchants can receive orders and use local Rider delivery;
- non-food businesses can be discovered, promoted and contacted without being forced into a delivery model;
- merchants gain low-cost local visibility without high marketplace GP;
- MyTree gradually builds its own local business graph, customer activity graph and community data moat;
- AI Co-workers reduce operating cost and improve execution without becoming the source of truth for deterministic business logic.

## 1.1 Core economic principles

- **Low / no GP**: do not reproduce the 30–40% commission economics of large delivery aggregators.
- MyTree should monetize through subscriptions, premium tools, transparent sponsored discovery, business services, corporate/community packages, supplier support and aggregated-demand infrastructure.
- COD / shop QR remain per-shop. MyTree does not hold delivery-fee money in Phase 1.
- Merchants and suppliers transact directly where possible; MyTree may aggregate demand/information without unnecessarily becoming the payment principal.

## 1.2 Identity principle

`customer_id` remains the internal identity anchor. LINE is an authentication/distribution provider, not the primary database identity.

---

# 2. Product Surfaces — APPROVED 2026-08-20

MyTree now has three clearly separated user surfaces.

## 2.1 Customer: LINE OA + Customer Web/App

**LINE OA keeps only one Rich Menu: Customer Rich Menu.**

Remove / retire:

- Shop Rich Menu
- Rider Rich Menu
- `Switch to Shop`
- `Switch to Rider`
- role-switching UX that exposes operational roles to normal customers

The customer-facing LINE experience should become a gateway into the broader MyTree consumer ecosystem rather than a food-only tool.

Target customer entry areas:

- **กินอะไรดี / Food** — ordering and reorder
- **รอบตัวฉัน / Community Map** — nearby discovery
- **ร้านค้า & บริการ** — non-food local business discovery/contact
- **โปร / วันนี้มีอะไร** — deals, daily specials, promoted content
- **ออร์เดอร์ของฉัน** — tracking/history
- **MyTree ของฉัน** — profile, favorites/follow, membership/personalization later

Customer public pages that matter for SEO must be viewable without mandatory LINE login.

## 2.2 Shop: MyTree Shop Native App

Shop operations move into the dedicated native app. LINE Login may still be used for identity, but the merchant should not need a Shop Rich Menu.

Shop App target capabilities:

- persistent login
- dashboard / order inbox
- accept/reject order
- order status management
- open/close shop
- menu CRUD
- item availability/stock toggle
- options/add-ons/sets
- shop profile, logo, address, location
- operating hours
- QR payment configuration
- payment slip review / payment status where applicable
- request Rider
- Rider assignment status
- cancel assigned Rider with reason
- delivery proof view
- notifications
- order history
- operational KPI/report layer
- promotions / premium tools later
- merchant subscription/account later

Web shop management remains a fallback during rollout until native parity is stable.

## 2.3 Rider: MyTree Rider Native App

Rider operations live entirely in the Rider native app.

Target capabilities:

- persistent login
- online/offline
- automatic foreground/resume synchronization
- location update
- nearby delivery offers
- accept delivery job
- current job
- shop/customer contact
- pickup
- delivered + proof photo
- Rider cancellation with structured reason
- job history
- notification settings
- profile / vehicle / document status
- KPI/history view later
- premium/subscription layer later

**Phase 1 Rider service remains food/package delivery only. Passenger transport is not part of the active Phase-1 Rider product.**

---

# 3. Authentication & Session Architecture — PRIORITY

Shop and Rider apps must behave like real work apps: users should not repeatedly log in through LINE after being away from the app.

## 3.1 Approved session direction

Use:

- short-lived access JWT for Supabase/RLS access;
- long-lived revocable refresh/session credential stored in Expo SecureStore;
- silent refresh through Worker/auth layer;
- app-resume synchronization;
- explicit logout/revoke support.

Expected UX:

```text
First install / first login
    -> LINE Login
    -> Worker verifies LINE identity
    -> access token + persistent refresh session
    -> SecureStore

Later app opens
    -> restore session
    -> access token valid? use it
    -> expired? silent refresh
    -> enter app without LINE Login screen
```

A full LINE login should normally be required only after logout, app-data removal/uninstall, session revocation, security invalidation or long session expiry.

Do **not** solve this simply by issuing extremely long-lived unrevocable JWTs.

---

# 4. Rider Delivery Flow V3 — FIRST ACCEPT MODEL — APPROVED 2026-08-20

The previous **Rider Interested -> Shop Select Rider** flow is superseded for delivery-only Phase 1.

## 4.1 New operating flow

```text
Shop accepts order
    ↓
Shop taps “ต้องการ Rider”
    ↓
Backend creates/opens delivery offer
    ↓
Eligible nearby online Riders receive push / see job
    ↓
Rider taps “รับงาน”
    ↓
Atomic first-accept transaction
    ↓
ONE Rider wins and is assigned immediately
    ↓
Other Riders see “มี Rider รับงานแล้ว”
    ↓
Shop receives push: Rider accepted
    ↓
Rider travels to shop
    ↓
Pickup
    ↓
Delivered + proof
```

There is **no second Shop-selection step** after a Rider accepts.

## 4.2 Atomic first-accept requirement

The backend is authoritative. If multiple Riders tap Accept nearly simultaneously:

- only one transaction can set `assigned_rider_id`;
- only the successful Rider receives the job;
- all later claims return a deterministic `job_already_taken` result;
- UI state must update from server truth, never local button state alone.

This is Rider-initiated acceptance, not silent platform auto-assignment.

## 4.3 Notifications

Native push is part of the transaction flow, not an optional UI convenience.

Required push events:

- new Rider offer -> eligible Riders
- Rider accepted -> Shop
- Shop cancels Rider -> assigned Rider
- Rider cancels -> Shop
- job reopened -> eligible Riders as policy allows
- important order status transitions where useful

Polling/realtime sync may remain as resilience/fallback, but background delivery cannot depend on an open screen.

---

# 5. Two-Sided Cancellation + Permanent Event History — APPROVED 2026-08-20

Both Shop and Rider need cancellation controls **before pickup**, with structured reasons and permanent history.

## 5.1 Rider cancellation

Examples:

- vehicle problem
- accepted by mistake
- cannot reach shop
- emergency
- job/location issue
- other + note

Result before pickup:

- assignment is released;
- cancellation event is written;
- Shop is notified;
- delivery returns to Rider-needed/reoffer state according to workflow.

## 5.2 Shop cancellation of assigned Rider

Use cases include:

- Rider not arriving
- Rider too slow
- cannot contact Rider
- order/customer cancelled
- shop operational issue
- other + note

Result before pickup:

- Rider is released;
- cancellation event is written;
- Rider is notified;
- shop may request/reopen Rider search.

## 5.3 After pickup

Once food/items have been marked picked up, normal “cancel Rider” must no longer be treated as a simple reassignment. This becomes an exception/dispute flow so delivery history and custody are not corrupted.

## 5.4 Cancellation/Event data is immutable operational history

Do not store only the latest cancellation fields on `sub_orders`. Add an append-only event/audit domain, e.g. reviewed migration for a structure similar to `delivery_events` / `delivery_cancellation_events`.

Required event dimensions should support:

- `sub_id`
- `shop_id`
- `rider_id`
- actor (`shop`, `rider`, `system`, future admin)
- event type
- structured reason code
- free-text note where allowed
- status before / after
- requested time
- accepted time
- cancelled time
- elapsed time since offer/accept
- known distance snapshot when relevant
- replacement/reoffer relationship
- timestamps / audit metadata

The event history is the source of truth. KPI scores are derived and recalculable.

---

# 6. KPI, Quality & Reporting Foundation

Cancellation history and delivery events must be retained for future KPI, quality management, disputes and reporting.

## 6.1 Rider KPI candidates

- jobs offered / viewed
- jobs accepted
- completed deliveries
- Rider cancellation count/rate
- accepted-then-cancelled rate
- no-show / serious incident count
- accept-to-pickup time
- pickup-to-delivery time
- completion rate
- reassignments caused

## 6.2 Shop KPI candidates

- Rider requests
- Shop cancellation of assigned Rider count/rate
- Rider-reported shop-not-ready cases
- Rider waiting time at shop
- order readiness delay
- reoffer/reassignment rate
- dispute/incident rate

## 6.3 Fair scoring principle

Do not treat every cancellation equally. KPI must consider:

- numerator and denominator, not raw cancellation count only;
- reason/severity;
- timing (e.g. immediate cancellation vs no-show after long delay);
- repeated patterns;
- sufficient sample size.

Phase 1 should **collect trustworthy events first**. Public-facing scores can wait until the scoring model has enough data and governance.

Reports may later support Shop, Rider, Admin and AI Ops use cases. This does not change the earlier restriction against resurrecting legacy daily-sales-summary UI merely because old sales-summary tables exist.

---

# 7. Community Map — CORE GROWTH FEATURE

**Decision dates:** 2026-08-16 / Seed + SEO refinement 2026-08-18  
**Status:** APPROVED

Community Map is the bridge from “food ordering” to “Daily Local Life”.

## 7.1 Purpose

Residents:

- discover nearby food, cafes, shops and services;
- see distance/open state;
- order from ordering-enabled merchants;
- call/contact non-ordering businesses;
- open external navigation.

Merchants/service providers:

- gain a local digital presence even if they do not use delivery;
- convert discovery into views, orders, calls/contact or directions;
- claim listings and later use premium marketing/profile tools.

## 7.2 Basemap architecture

Use a real Google Maps geographic basemap.

Google:

- roads / geography / coordinates
- pan / zoom
- navigation handoff

MyTree:

- MyTree pins/style
- community/business data
- categories
- search/discovery
- open-now / near-me
- preview bottom sheet
- order/contact/directions actions
- claimed/verified status
- promotions/sponsored layer later

Do not build turn-by-turn navigation inside MyTree.

## 7.3 Data-source rule

Do not create a duplicate `map_shops` source of truth.

Use existing shop/listing domain and extend through reviewed migrations when needed, including fields such as:

- category / subcategory
- short description
- map visibility
- location verification
- source/reference metadata
- external place reference where permitted

Promotions remain a separate domain.

## 7.4 Location verification

```text
Business profile
  -> search/enter location
  -> show map
  -> owner confirms pin
  -> capture lat/lng
  -> validation
  -> verification
  -> eligible MyTree pin
```

Manual admin verification is acceptable during the Sammakorn pilot.

## 7.5 Community Map Seed Strategy

Use **Google Places as a runtime discovery/seed layer** to prevent an empty map.

Rules:

- Google-sourced businesses are not MyTree merchant records merely because they appear on the map.
- Do not bulk-copy/scrape Google Places into MyTree-owned merchant data.
- `google_place_id` may be an external bridge/reference where current platform policy permits.
- obey current display, caching and attribution rules at implementation time.
- visually distinguish Google-sourced/unclaimed results from MyTree claimed/verified listings.

Lifecycle:

```text
Google discovery result
  -> external/unclaimed map result
  -> merchant Claim/Register
  -> MyTree verifies + collects MyTree-owned data
  -> linked claimed listing
  -> MyTree-owned data becomes listing source of truth
```

## 7.6 SEO policy

- **Google-sourced unclaimed listing -> Map only, not an indexable page built from copied Google content.**
- **Claimed MyTree merchant -> indexable when merchant-provided/verified MyTree content is sufficient.**
- **Community-verified MyTree-owned listing -> indexable when quality rules are met.**

Target structure:

```text
mytree.cc/map
mytree.cc/{community}
mytree.cc/{community}/{category}
mytree.cc/shop/{slug}
```

SEO-critical pages should be crawl-friendly (SSR/static/pre-render or equivalent), use stable canonical URLs and original MyTree-owned content.

## 7.7 Community Map MVP

- Sammakorn-centered Google basemap
- MyTree map style/pins
- MyTree claimed/verified pins
- Google runtime seed results with clear external labeling
- categories
- search
- near me
- distance
- open/closed state
- clustering
- business preview bottom sheet
- View shop
- Order for ordering-enabled food merchants
- Call/Contact for non-ordering listings
- Directions handoff
- mobile-first customer experience

Map MVP must **not depend on an LLM**.

---

# 8. Expansion Beyond Food — APPROVED DIRECTION

MyTree merchant participation is not limited to restaurants.

Non-food categories may include local services and businesses where MyTree provides discovery, profile, promotion and direct contact without requiring a delivery transaction.

Architectural implication: separate capabilities such as:

- `listing_enabled`
- `ordering_enabled`
- `delivery_enabled`
- contact/directions actions

rather than assuming every business has a menu and Rider workflow.

This enables MyTree to grow supply quickly while keeping food ordering as the first strong transactional wedge.

---

# 9. Daily-Use Consumer Growth Layer

The customer product should increase reasons to open MyTree even when the user is not placing a food order.

Priority concepts:

- **MyTree Today** / what is happening nearby now
- Favorites / Follow
- Reorder
- Nearby / Community Map
- Daily Specials / local deals
- useful notification preferences
- shops & services discovery
- later shopping/reminder/restock workflows
- later personalized “กินอะไรดี” / natural-language discovery after deterministic search/data quality is strong

The purpose is to move from occasional ordering to **daily local utility**.

---

# 10. Revenue Architecture — LOW/NO GP

Revenue should be layered rather than depending on order commission.

## 10.1 Free network / acquisition stage

- free basic listing
- free initial merchant/rider participation during pilot
- grow local density and usage first

## 10.2 Freemium merchant subscriptions

Earlier planning range to validate with pilot economics:

- **Plus:** approximately ฿199–299/month
- **Pro:** approximately ฿499–799/month

Potential paid value:

- enhanced profile/media
- promotion publishing
- member offers
- analytics/insights
- productivity tools
- more advanced merchant features

Pricing is a planning range, not a final published price.

## 10.3 Corporate / community packages

Indicative planning range: approximately **฿3,000–30,000+** depending on scope.

Potential customers:

- villages/communities
- property/community operators
- local organizations
- business groups
- larger merchants needing additional tools/support

## 10.4 Sponsored discovery / ads

- clearly labeled Sponsored placements
- separate paid placement from organic ranking
- local campaign/promotional inventory
- do not silently distort organic recommendations

## 10.5 Supplier Support + Demand Pool

Longer-term MyTree can aggregate merchant demand to create purchasing leverage without becoming the merchant-of-record unnecessarily.

Potential evolution:

```text
merchant demand signals
  -> pooled/aggregated demand
  -> supplier offers/support
  -> supplier marketplace / comparison
  -> reverse-auction / negotiated buying layer later
```

Merchants may pay suppliers directly while MyTree earns from supplier support, services, marketplace/infrastructure value or other transparent business models.

## 10.6 Infrastructure / API layer later

Once MyTree has proven community/merchant operations, selected APIs, automation or infrastructure services can become another B2B revenue layer.

---

# 11. Hybrid AI Co-work Network — ARCHITECTURE DECISION

MyTree uses a **provider-agnostic Hybrid AI Co-work Network**.

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

## 11.1 Routing principle

1. **Rules / SQL first** — pricing, authorization, state machines, fee calculation, KPI math and other deterministic logic.
2. **Qwen / self-hosted open-weight model** — repetitive/high-volume/private extraction, classification, summarization, FAQ, monitoring and routine workloads once volume justifies infrastructure.
3. **OpenAI economical model** — general cloud AI where API economics are preferable.
4. **OpenAI advanced reasoning/coding model** — architecture, debugging, incidents, difficult reasoning, coding and exception work.
5. **Human approval** — legal, financial, governance, safety-sensitive, destructive or high-impact actions.

## 11.2 Security rules

- no unrestricted LLM production DB write access;
- AI uses controlled tools/API/RPCs;
- explicit scopes and input validation;
- audit every AI action;
- cost/rate controls;
- privileged approve/ban/payment/destructive actions are not autonomous in early stages;
- provider must remain replaceable.

## 11.3 AI rollout stages

### Stage A — foundation, small parallel track NOW

- AI Gateway/provider abstraction
- provider routing contract
- tool registry
- task schema
- AI audit events
- confidence/escalation fields
- cost/token/latency telemetry
- read-only access conventions
- human-approval pattern

Do not insert AI into critical ordering, payment or Rider state transitions.

### Stage B — first production coworker after core Shop/Rider gate is green

**MyTree Ops Coworker V1** — read-only/flagging first.

Responsibilities:

- detect stuck/unusual workflow states
- summarize incidents/errors
- detect incomplete merchant/Rider data
- prepare support/admin drafts
- flag problems for humans

No autonomous production-state repair in V1.

### Stage C — Sammakorn pilot operations

Add low-risk coworkers:

- Support L1
- Shop onboarding assistant
- Menu/data cleanup
- FAQ assistant
- classification/tagging
- Community Map listing-quality assistant
- KPI/operations anomaly explanation

Measure accuracy, human correction, escalation, latency, token use and cost per resolved task.

### Stage D — growth

A/B test Qwen/self-hosted on proven low-risk high-volume workloads. Move only when measured economics/privacy/control justify it. Keep advanced cloud models as escalation.

---

# 12. Community Map + AI Relationship

Community Map core functions remain deterministic:

- coordinates
- distance
- category filtering
- open/closed
- viewport
- location verification
- directions
- claimed/verified state

AI may later assist with:

- merchant description/category cleanup
- missing-data detection
- tags
- onboarding drafts
- listing-quality monitoring
- natural-language discovery

AI must not block Map MVP launch.

---

# 13. Engineering / Governance Constraints

1. Keep RLS, guard triggers and SECURITY DEFINER patterns intact; never weaken them for convenience.
2. Choose **one canonical Supabase migration history** before more schema-heavy work; the two repos must not diverge indefinitely.
3. Never hard-delete Shop/Rider records when history would break; use governed deactivation/ban.
4. Preserve customer/order/delivery history.
5. No hidden sponsored ranking.
6. No passenger service in the active Phase-1 Rider flow.
7. Native apps never contain service-role keys, JWT signing secrets, LINE channel secret or private signing credentials.
8. Backend owns all race-sensitive assignment/state transitions.
9. Event history used for KPI must be append-only/auditable where practical.

---

# 14. Master Execution Roadmap — APPROVED 2026-08-20

The ordering below supersedes the previous simple “finish Rider V2 then Map” sequence because Shop/Rider native usability and the delivery state machine now have explicit priority.

## PHASE 0 — Source-of-truth / regression guard

**Do first; keep short.**

- reconcile production Worker vs GitHub branches/endpoints
- choose canonical migration owner
- protect Ordering Flow v2 from regression
- baseline current production behavior/tests

**Exit gate:** current customer ordering still works; DB/Worker versions are known and reproducible.

## PHASE 1 — Shop Native App operational completion

Priority order:

1. persistent session + silent refresh
2. Shop order inbox/detail sync
3. reliable new-order native push
4. accept order
5. preparing/ready states
6. open/close shop
7. menu management parity
8. profile/location/payment settings
9. background/resume state synchronization

**Exit gate:** Shop can run daily operations without LINE Rich Menu or repeated login.

## PHASE 2 — Rider Native + Delivery V3 completion

Priority order:

1. persistent Rider session + silent refresh
2. online/offline/location sync
3. Shop “ต้องการ Rider”
4. native offer push
5. atomic first Rider accept
6. Shop push when Rider accepts
7. current-job state
8. pickup
9. delivered + proof
10. Rider cancellation
11. Shop cancellation of assigned Rider
12. reoffer/reassignment
13. full delivery event history
14. Rider job history

**Exit gate:** complete delivery can run end-to-end with app closed/background push behavior and no Shop-selection step.

## PHASE 3 — KPI / Audit / Reporting Foundation

- append-only delivery/cancellation events
- reason-code taxonomy
- operational timestamps
- Rider KPI queries/views/services
- Shop KPI queries/views/services
- admin incident/report read model
- instrument push/assignment/cancellation failures

Do not over-design public scores yet.

## PARALLEL LANE A — AI Stage A Foundation

May start alongside Phases 1–3 because it is low-risk infrastructure only:

- gateway/provider interface
- tools/audit schema
- read-only tool conventions
- telemetry

Do not let AI work delay Shop/Rider launch.

## PHASE 4 — Customer Surface Cleanup + LINE Simplification

- retire Shop/Rider Rich Menus
- keep Customer Rich Menu only
- remove role-switch confusion
- redesign Customer Rich Menu for Food + Map + Local Business + Offers + Orders + MyTree profile
- verify LINE login/customer ordering remains intact

## PHASE 5 — Non-Food Listing Foundation

Before Map expansion, make business model explicit in schema/UI:

- merchant categories
- ordering-enabled vs listing-only capability
- contact/directions actions
- claim flow
- verified location
- merchant profile suitable for food and non-food

## PHASE 6 — Community Map MVP

- Google basemap
- MyTree pins
- MyTree claimed/verified listings
- Google runtime seed layer
- category/search/near-me/open-now
- listing preview
- order/contact/directions
- location verification
- pilot data-quality tools

## PHASE 7 — Owned SEO Layer

- Sammakorn community page
- category pages
- claimed merchant pages
- crawl-friendly rendering
- canonical URLs/slugs
- structured data where appropriate
- no indexable pages made from copied Google seed content

## PHASE 8 — Sammakorn Integrated Pilot

Pilot together:

- Customer ordering
- Shop Native
- Rider Native
- Delivery V3
- cancellation/KPI logging
- Customer Rich Menu only
- Community Map
- food + selected non-food listings

Measure:

- active customers
- repeat use
- orders
- Rider acceptance/completion
- cancellation patterns
- merchant claims
- Map searches/actions
- contact/directions conversions
- notification reliability
- support burden
- operating cost

## PARALLEL LANE B — MyTree Ops Coworker V1

Start after Phases 1–3 are stable enough to observe trustworthy states.

Use read-only tools to monitor the integrated pilot and surface incidents/data-quality problems.

## PHASE 9 — Daily-Use Growth Features

Prioritize based on pilot evidence:

- MyTree Today
- Favorites/Follow
- Reorder
- Daily Specials/Deals
- smart but user-controlled notifications
- broader local business/service discovery
- useful personalized discovery

## PHASE 10 — Monetization V1

After local density/adoption is proven:

- Freemium merchant tiers
- enhanced merchant profiles
- promotions/member offers
- transparent sponsored placements
- selected Corporate/community packages
- Rider premium/subscription only when free Phase-1 behavior is proven and pricing/value is clear

## PHASE 11 — AI Co-worker Expansion

- Support L1
- onboarding assistant
- merchant data cleanup
- Map listing-quality assistant
- KPI/operations assistant
- Qwen/OpenAI routing optimization

## PHASE 12 — Supplier Network / Demand Pool

After merchant density is meaningful:

- aggregate demand signals
- supplier comparison/support
- pooled demand
- supplier marketplace
- reverse-auction/negotiation tools later
- keep merchant profitability and direct supplier payment principles in mind

## PHASE 13 — Scale Beyond Sammakorn

Expand geographically only after the pilot proves:

- reliable operations
- sufficient local data quality
- repeat customer utility
- sustainable acquisition/retention
- manageable support cost
- viable monetization signals

---

# 15. Immediate Work Order — START HERE

1. **Reconcile Shop/Rider frontend + Worker production endpoints and branches.**
2. **Implement persistent Shop/Rider authentication with silent refresh.**
3. **Replace Interested -> Shop Select with Delivery V3 atomic first-accept flow.**
4. **Implement reliable two-way native push around offer/accept/cancel.**
5. **Implement Shop + Rider cancellation before pickup and reoffer behavior.**
6. **Add append-only delivery/cancellation event history for KPI.**
7. **Finish Shop Native operational parity: orders, open/close, menu, profile, payment.**
8. **Finish Rider Native job lifecycle/history.**
9. **Retire Shop/Rider LINE Rich Menus; keep Customer Rich Menu only.**
10. **Start AI Gateway Stage A as a small parallel foundation.**
11. **Build non-food listing capability + shop location verification.**
12. **Build Community Map MVP + Google seed strategy.**
13. **Build owned SEO pages from claimed/verified MyTree data.**
14. **Run Sammakorn integrated pilot.**
15. **Then activate Daily-Use growth, monetization and AI Co-worker expansion according to measured evidence.**

---

# 16. Superseded Decisions / Migration Notes

The following older directions must not be treated as current product behavior after this Bible update:

- **Three role-based LINE Rich Menus** -> superseded by Customer Rich Menu only; Shop/Rider use native apps.
- **Rider Interested -> Shop selects Rider** -> superseded by Rider atomic first-accept for Phase-1 delivery jobs.
- **Repeated LINE login in Shop/Rider apps** -> superseded by persistent revocable session + silent refresh architecture.

Existing code, DB functions or old documents may still reflect these older flows during migration. Engineering must explicitly reconcile them rather than assuming old code is the desired behavior.

---

**This Bible snapshot dated 2026-08-20 is the approved master roadmap until a later decision explicitly supersedes it.**
