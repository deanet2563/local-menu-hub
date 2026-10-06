# Customer reconciliation — 2026-10-06

## A — Inventory complete
Canonical: b49c8ac2fd588e699ba4aa49eea4cdf9fa23f566.
Home #111: 4e51db53282c97a90bdc3b6d1e5bf2739fd31c82.
Food Hub #97: abe6f6379f86f128a1cedcc415f6e8755f376234.

A trial merge-tree (no branch mutation) found 13 conflicts for Home, spanning
location picker, HubHome, ShopPage, ShopProfileManager, shopVerification,
Supabase/LIFF, generated routes, root navigation, Account, Cart, Hub, Home and Map.
The original Home branch also carries multi-shop cart and Shop management work.

## B — Home slice
Rebuild on canonical using only HomeOverview, HomeErrorBoundary, FloatingCartBar,
catalog hook, category mapping, brand asset and Home route from the old work.
Preserve canonical auth, origin confinement, root navigation, Map, checkout,
single-shop cart, Shop management and moderation without restoring older copies.

Fix discovered during extraction:
- Remove demo promotion generation entirely.
- Read merchant-managed shop_promotions with active/start/end filters; optional
  unavailable source fails closed without blanking catalog. Schema source:
  existing Shop branch migration 20260904081000_shop_promotions.sql. No migration
  is added or applied; live schema availability remains a release gate.
- Label nearby directory honestly: closed approved shops remain discoverable.
- Preserve cross-shop confirmation and recheck catalog open state on confirm.
- Hide floating cart behind configurator and keep unknown distances unknown.
- Remove unverified free-POS advertising from merchant signup CTA.

## C — Food Hub slice
Port only the FoodHub route/component/boundary plus opt-in hub catalog enrichment
and the minimal closed-Shop add guard, on top of B. Keep existing ShopPage map,
order sets and authorization behavior. Do not restore the old whole ShopPage.

## D — Release gates
- Local build/typecheck and catalog/auth regression tests.
- Mobile 390x844 and desktop 1440x900 browser checks with synthetic transport only.
- Required CI and current-head review; no gate bypass.
- Real staging catalog, promotion query and LINE/device QA remain required.
- Old #111/#97 remain intact for provenance; no automatic closure or merge.
- No Production merge/deploy, database write, test order or migration execution.
