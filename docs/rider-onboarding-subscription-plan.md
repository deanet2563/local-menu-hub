# MyTree Rider Onboarding + Subscription Readiness

Status: design/preparation only. No monthly fee is charged by this change.

## Non-negotiable constraints

- Do not modify or couple this work to the customer Ordering Flow.
- Keep rider assignment as shop-selected/manual directory flow; no auto-dispatch or rider job claiming.
- Delivery fees are paid directly between shop/customer/rider. MyTree does not collect delivery-fee money.
- A future MyTree monthly rider membership/platform fee is a separate commercial relationship from delivery fees.
- Never hard-delete rider records; preserve historical deliveries.

## Current rider signup flow (source baseline)

1. Authenticate through LINE/LIFF and resolve `customer_id`.
2. Enter name and phone.
3. Select vehicle type.
4. Select rider class:
   - `general`: delivery / errand only.
   - `public_win`: registered public motorcycle taxi; passenger service remains disabled until document verification.
5. Select offered services.
6. For `public_win`, enter plate number, win/public-license number, and optional win zone.
7. Share current location (required).
8. Insert rider row.
9. Admin separately calls `fn_approve_rider` and, for public-win document verification, `fn_verify_rider_document`.
10. Approved rider can go online and appear in the rider directory.

## Gaps to close before production rider onboarding

### A. Identity and operational verification

Add a staged onboarding model rather than one long form:

- Step 1 — Account: LINE identity, full name, phone.
- Step 2 — Vehicle: vehicle type and registration information.
- Step 3 — Services: delivery / errand; passenger only for eligible verified `public_win`.
- Step 4 — Service area/location: home/base location or current operating area.
- Step 5 — Verification documents (private storage): required documents based on rider class.
- Step 6 — Terms + PDPA acknowledgement and consent metadata.
- Step 7 — Review and submit.
- Step 8 — Admin review.
- Step 9 — Approved / needs correction / rejected state.

Do not put sensitive verification documents in a public Supabase bucket. Create a private bucket and signed/admin-only access path before enabling uploads.

### B. Verification state should be explicit

Avoid deriving the whole onboarding state from only `is_approved` and `verified_at`.

Recommended future states:

- `draft`
- `submitted`
- `under_review`
- `needs_correction`
- `approved`
- `rejected`
- `suspended`

Keep existing `is_approved` / `is_banned` initially for backward compatibility; add the onboarding state alongside them and migrate behavior gradually.

### C. Document records

Prefer a separate `rider_documents` table rather than many URL columns on `riders`.

Suggested fields:

- `id`
- `rider_id`
- `document_type`
- `storage_path`
- `status` (`pending`, `verified`, `rejected`, `expired`)
- `expires_at` nullable
- `reviewed_at`
- `reviewed_by`
- `rejection_reason`
- timestamps

This supports future document renewal without replacing rider history.

## Subscription readiness — future monthly rider fee

### Principle

Do not make subscription/payment state part of order records and do not overload `is_approved`.

Use a separate entitlement layer:

`identity/approval` -> `subscription entitlement` -> `can appear online / directory`

An approved rider may be temporarily non-entitled because a membership expired without losing their historical approval or delivery history.

### Recommended tables

#### `subscription_plans`

- `id`
- `code`
- `name`
- `actor_type` (`rider`, later optionally `shop`)
- `price`
- `currency`
- `billing_interval` (`month`)
- `trial_days`
- `is_active`
- `effective_from` / `effective_to`
- metadata

#### `rider_subscriptions`

- `id`
- `rider_id`
- `plan_id`
- `status` (`trialing`, `active`, `grace`, `past_due`, `paused`, `cancelled`, `expired`)
- `starts_at`
- `current_period_start`
- `current_period_end`
- `grace_until`
- `cancel_at_period_end`
- timestamps

#### `subscription_invoices`

- `id`
- `subscription_id`
- `period_start` / `period_end`
- `amount_due`
- `currency`
- `status` (`open`, `pending`, `paid`, `void`, `failed`)
- `due_at`
- `paid_at`
- provider/reference fields
- timestamps

#### `subscription_payments`

There is an inherited table with this name in the existing database according to the project handoff. Do NOT use or alter it until its live schema, RLS, writers, and readers are audited. If compatible, migrate it deliberately; otherwise create a new versioned replacement.

### Entitlement helper

Eventually expose one database helper/function such as:

`fn_rider_has_active_entitlement(rider_id)`

Directory visibility / online eligibility should be based on:

- approved
- not banned
- onboarding complete
- subscription entitlement active OR platform is in free-pilot mode

Do not scatter subscription checks across React components.

### Free-pilot compatibility

Introduce platform configuration such as:

- `rider_subscription_enforcement_enabled = false`

While false:

- all approved riders keep access without payment.
- subscription rows may be created as free/trial records for testing.

When commercial launch begins, enforcement can be enabled without changing rider identity or historical orders.

### Grace period

Do not immediately ban/deactivate a rider when a monthly payment is late.

Recommended flow:

`active -> past_due -> grace -> expired/paused`

During grace, surface payment reminders but preserve account data and completed delivery history.

### Payment architecture

Keep monthly MyTree fees separate from order and delivery payments.

Future options can include:

- manual QR/bank transfer with admin confirmation for pilot
- payment gateway recurring billing when volume justifies it

Whichever provider is chosen later, store provider-specific IDs outside core rider/order identity fields.

## Recommended implementation sequence

### Rider V1.1 — onboarding quality

1. Convert signup UI to step-based flow without changing current rider insert semantics yet.
2. Add terms/PDPA acknowledgement UI + version metadata.
3. Add admin-visible onboarding status.
4. Add private rider-document storage and `rider_documents` only after DB migrations are versioned.
5. Add correction/re-submit flow.

### Rider V1.2 — maps + delivery operations

1. Customer delivery lat/lng alongside address (non-breaking addition to Ordering Flow).
2. Rider mini-map / pickup + drop-off pins.
3. External Google/Apple navigation handoff.
4. failed-delivery reason flow.
5. delivery distance / fee display once the fee model is finalized.

### Rider V1.3 — subscription-ready foundation

1. Audit inherited `subscription_payments` table.
2. Add versioned subscription plan/subscription/invoice schema.
3. Add free-pilot entitlement helper with enforcement OFF.
4. Add rider dashboard membership card showing `Free pilot` / future renewal date.
5. Add admin subscription view.

### Commercial subscription launch (later)

1. Select payment provider and legal/accounting treatment.
2. Implement provider callbacks/webhooks idempotently.
3. Turn on subscription enforcement only after migration, retry, grace-period and support flows pass production tests.

## Acceptance guardrails

- Existing customer checkout and `/order` behavior remains unchanged.
- Existing rider delivery history remains readable even after subscription expiration.
- Subscription expiration never hard-deletes or bans a rider.
- `general` riders never gain passenger-service access through subscription status.
- public-win passenger eligibility still requires document verification independent of subscription payment.
- Delivery fee and MyTree monthly membership fee remain separate concepts in UI, database, and accounting.
