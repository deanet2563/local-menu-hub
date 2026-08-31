# MyTree Bible Addendum — Rider Revenue & Route Cost Control

**Decision date:** 2026-08-31  
**Status:** APPROVED — Master Plan / Revenue Architecture / Rider Cost Control

This addendum records approved Rider economics and cost-control rules. Where this document is more specific than earlier planning notes, this later approved decision takes precedence.

---

## 1. Google Routes Cost-Control Rule — P0

MyTree must use the following production rule for delivery route pricing:

> **1 Delivery Order = 1 authoritative route calculation**

The authoritative Shop → Customer road-route calculation is performed once for the delivery order, then the resulting values are snapshotted on the order and reused by Customer, Shop, Rider and Admin surfaces.

Required snapshot fields include, at minimum:

- `route_distance_m`
- `route_duration_s`
- `route_provider`
- `delivery_fee_rate_per_km`
- `calculated_delivery_fee`

Rules:

- Do not call Google Routes again merely because Rider refreshes the job list or reopens the app.
- Do not recalculate the same delivery route separately for Customer, Shop and Rider.
- Financial delivery pricing must use the authoritative stored route snapshot rather than a client-side estimate.
- Haversine may remain for non-financial proximity/search use cases such as Rider → Shop eligibility, but it must not be presented as road distance for delivery-fee calculation.
- Google Routes credentials remain server-side only.
- Before production scale, configure Google Cloud API quotas and billing alerts to protect against bugs, abuse and unexpected API spend.

This is a P0 cost-control and financial-consistency requirement.

---

## 2. Rider Membership Revenue Model — APPROVED DIRECTION

MyTree should prioritize Rider supply, liquidity and delivery traffic before charging Riders.

### 2.1 Acquisition stage

During the pilot / early-network stage:

- Rider participation may remain free.
- Do not enforce paid membership while local job density is still being built.
- The primary goal is enough active Riders and enough completed delivery volume for a healthy marketplace.

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
- Existing Rider identity, approval, ban status, online status and delivery capability remain separate concerns from paid entitlement.

---

## 4. Future Activation Principle

Paid Rider membership should be activated only when MyTree has enough delivery demand that charging Riders does not materially damage Rider availability or order fulfillment.

Before enforcement, review at least:

- active Riders per day/week
- Rider online hours
- offers per Rider
- completed jobs per Rider
- Rider acceptance rate
- time-to-first-accept
- unfilled Rider requests
- Rider earnings opportunity
- order density by community/zone
- Rider churn / retention

The final go-live threshold for paid Rider access is a future business decision and is intentionally not hard-coded in this addendum.

---

## 5. Revenue Principle

Rider membership is part of MyTree's broader low/no-GP revenue architecture. The intent is to monetize access to useful local demand without taking a large commission from each delivery transaction.

The preferred long-term Rider model is therefore:

```text
Build demand + Rider liquidity first
        ↓
Prove recurring Rider earning opportunity
        ↓
Enable Rider paid entitlement
        ↓
฿30 Daily Pass for occasional Riders
or
฿500 Monthly Membership for frequent Riders
```

This model must remain compatible with the canonical Rider Delivery V3 flow:

**Shop Request → Rider First Accept → Atomic Auto Lock → Shop Notified → Pickup → Delivered + Proof**

Paid entitlement must never weaken Atomic First Accept, RLS, delivery guards, audit history or server-authoritative assignment.