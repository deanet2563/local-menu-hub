# MyTree Bible Addendum — Rider Revenue & Route Cost Control

**Decision date:** 2026-08-31  
**Status:** APPROVED — Master Plan / Revenue Architecture / Rider Cost Control

This addendum records approved Rider economics, cost-control rules and the long-term Rider product direction. Where this document is more specific than earlier planning notes, this later approved decision takes precedence.

---

## 1. Google Routes Cost-Control Rule — P0

MyTree must use the following production rule for delivery route pricing:

> **1 Delivery Order = 1 authoritative route calculation**

The authoritative Shop → Customer road-route calculation is performed once for the customer-confirmed destination, then the resulting values are bound to a server-side quote/intent and snapshotted on the order. Customer, Shop, Rider and Admin reuse the same authoritative values.

### 1.1 Pre-submit quote lifecycle

Ordering Flow V2 must still show the customer the delivery fee before final order submission. Therefore the one-calculation rule uses this lifecycle:

```text
Customer confirms destination
        ↓
Server calculates authoritative road route ONCE
        ↓
Server creates short-lived quote/intent bound to shop + destination + route result + fee
        ↓
Customer sees the authoritative fee before confirming the order
        ↓
Order creation consumes/reuses that quote idempotently
        ↓
Route values are snapshotted onto sub_orders
        ↓
Customer / Shop / Rider / Admin reuse the stored snapshot
```

Order submission must not make a second Google Routes call merely to recreate the same route. If the immutable inputs that affect pricing change before submission (for example shop or customer destination), the previous quote becomes invalid and a new authoritative calculation is required.

Required snapshot fields include, at minimum:

- `route_distance_m`
- `route_duration_s`
- `route_provider`
- `delivery_fee_rate_per_km`
- `calculated_delivery_fee`

Rules:

- Do not call Google Routes again merely because Rider refreshes the job list or reopens the app.
- Do not recalculate the same delivery route separately for Customer, Shop and Rider.
- Financial delivery pricing must use the authoritative server quote/snapshot rather than a client-side estimate.
- Haversine may remain for non-financial proximity/search use cases such as Rider → Shop eligibility, but it must not be presented as road distance for delivery-fee calculation.
- Google Routes credentials remain server-side only.
- Quote creation and consumption must be rate-limited/authenticated sufficiently to prevent paid-API abuse.
- Before production scale, configure Google Cloud API quotas and billing alerts to protect against bugs, abuse and unexpected API spend.

This is a P0 cost-control and financial-consistency requirement.

---

## 2. Rider Membership Revenue Model — APPROVED DIRECTION

MyTree should prioritize Rider supply, liquidity and task traffic before charging Riders.

### 2.1 Acquisition stage

During the pilot / early-network stage:

- Rider participation may remain free.
- Do not enforce paid membership while local job density is still being built.
- The primary goal is enough active Riders and enough completed jobs for a healthy marketplace.

### 2.2 Paid Rider plans after sufficient traffic

Once MyTree has meaningful Rider traffic and job density, the planned Rider monetization model is:

- **Monthly Rider Membership:** ฿500/month, flat-rate access.
- **Daily Rider Pass:** ฿30/day.

The daily plan must support an explicit **activate/deactivate model** so a Rider who works only occasionally is not forced into a monthly subscription.

The business logic should make the monthly plan naturally attractive to frequent Riders while preserving a low-entry-cost daily option for part-time Riders.

These are approved planning prices and may be validated against real pilot economics before public launch.

---

## 3. Subscription Architecture Foundation

The architecture should be prepared for Rider subscription enforcement, but **enforcement remains OFF until a later approved traffic/revenue milestone**.

The backend should eventually support concepts equivalent to:

- `rider_subscription_plan`
- `rider_subscription_status`
- `daily_pass_active`
- `valid_from`
- `valid_until`
- `payment_status`

Implementation may normalize these into dedicated subscription/pass/payment tables rather than storing every field directly on the Rider row. The backend remains authoritative for whether a Rider is eligible to receive or accept paid-plan-gated work.

Requirements:

- Subscription state must not be trusted from client UI alone.
- Entitlement checks must be server-authoritative.
- Payment history and entitlement changes must be auditable.
- Admin must be able to review subscription/pass status and exceptional cases.
- Future pricing changes should not require rewriting historical payment records.
- Existing Rider identity, approval, ban status, online status and task capability remain separate concerns from paid entitlement.

---

## 4. MyTree Rider Long-Term Product — Local Task & Delivery Network

MyTree Rider is **not limited to food delivery**. The approved long-term direction is a local work network for transporting items and completing practical community errands.

Phase 1 remains food/package delivery while the core First Accept, location, push, proof, cancellation and KPI systems are stabilized. The architecture must nevertheless avoid hard-coding the platform around food-only jobs.

Target future job categories include:

- `food_delivery` — restaurant / food delivery
- `parcel` — parcels and general goods
- `document` — documents and small-item courier work
- `pickup_and_deliver` — collect an item from a shop/person and deliver it
- `buy_for_me` — purchase requested goods and deliver them
- `errand` — approved local errands such as collecting keys, documents or items
- `merchant_courier` — local merchant/business courier work
- scheduled deliveries and other reviewed local task types later

### 4.1 Generic job architecture

Long-term job design should converge toward a generic task domain rather than creating a separate incompatible workflow for every category:

```text
Job
  → job_type
  → pickup
  → dropoff / task destination
  → schedule
  → route / distance
  → fee
  → requirements
  → assignment
  → proof
  → status + immutable event history
```

Where appropriate, the existing Rider foundations should be reused:

- Rider identity / approval / ban state
- online/offline and location freshness
- nearby job discovery
- push notifications
- Rider First Accept
- Atomic Auto Lock
- cancellation + immutable event history
- pickup / completion proof
- KPI / quality layer
- monthly membership / daily pass entitlement

### 4.2 Passenger transport boundary

Passenger transport is **not part of the current approved Rider scope**. It carries materially different licensing, insurance, safety and regulatory requirements and must not be silently added to the delivery/task system.

A future passenger product would require a separate explicit business/legal/architecture decision.

### 4.3 Product positioning

Long-term MyTree Rider positioning should be understood as:

> **Local Task & Delivery Network — งานใกล้ตัวสำหรับ Rider: ส่งอาหาร ส่งของ รับของ และช่วยทำธุระในชุมชน**

The business objective is to increase the number and diversity of useful local earning opportunities available to each Rider without abandoning MyTree's low/no-GP principle.

---

## 5. Future Activation Principle

Paid Rider membership should be activated only when MyTree has enough task demand that charging Riders does not materially damage Rider availability or fulfillment.

Before enforcement, review at least:

- active Riders per day/week
- Rider online hours
- offers per Rider
- completed jobs per Rider
- Rider acceptance rate
- time-to-first-accept
- unfilled Rider requests
- Rider earning opportunity
- job density by community/zone and job type
- Rider churn / retention

The final go-live threshold for paid Rider access is a future business decision and is intentionally not hard-coded in this addendum.

---

## 6. Revenue Principle

Rider membership is part of MyTree's broader low/no-GP revenue architecture. The intent is to monetize access to useful local demand without taking a large commission from each task transaction.

The preferred long-term Rider model is therefore:

```text
Build demand + Rider liquidity first
        ↓
Prove recurring Rider earning opportunity across delivery + local tasks
        ↓
Enable Rider paid entitlement
        ↓
฿30 Daily Pass for occasional Riders
or
฿500 Monthly Membership for frequent Riders
```

For delivery jobs, this model must remain compatible with the canonical Rider Delivery V3 flow:

**Shop Request → Rider First Accept → Atomic Auto Lock → Shop Notified → Pickup → Delivered + Proof**

Paid entitlement and future job categories must never weaken Atomic First Accept, RLS, delivery guards, audit history or server-authoritative assignment.