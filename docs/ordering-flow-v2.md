# MyTree Ordering Flow v2

Status: implementation branch `mytree/ordering-flow-v2`.

## Non-negotiable product rules

- One shop per cart.
- Supports Order Now and Pre-order.
- Supports Pickup and Delivery.
- Payment is direct to the shop: Cash or QR transfer. MyTree does not hold shop or delivery money.
- No rider auto-dispatch or auto-assignment. The shop controls order acceptance and rider selection.
- Existing shop info, opening-hours logic, pre-order behavior, cash/QR checkout, shop QR, and LIFF/cache fixes must not be removed.

## Customer ordering flow

1. Choose shop/menu item or set.
2. Configure quantity.
3. Configure required/optional product options.
4. Add item-level note.
5. For a set/bundle, fill all required selection groups.
6. Add configured line to cart.
7. Review/edit cart.
8. Choose Pickup or Delivery.
9. Choose Order Now or Pre-order and requested time.
10. Enter/confirm delivery address when applicable.
11. Show delivery fee when applicable.
12. Choose Cash or QR transfer.
13. Review final order.
14. Submit order.
15. Order enters `pending` = waiting for shop acceptance.
16. Shop explicitly accepts (`confirmed`) or cancels/rejects.
17. Customer follows preparation and pickup/delivery status.

## Configurable options

Options are shop-defined rather than hard-coded. Examples:

- Heat: warm / normal / cold.
- Spiciness: not spicy / mild / medium / hot.
- Size: S / M (+price) / L (+price).
- Add-ons: egg, cheese, toppings.
- Exclusions: no onion, no vegetables, etc.

Each option group must support:

- required vs optional;
- minimum and maximum selections;
- single-select or multi-select via min/max;
- per-option price delta;
- sort order and active state;
- reuse across multiple menu items/categories where practical.

## Sets / bundles

A set is a priced parent product with one or more selection groups. Each group defines which menu items are eligible and how many units the customer must/can choose.

Examples:

- `4-bun set`: choose exactly 4 buns from the bun category, mixed fillings allowed.
- `Snack box`: choose 2 buns + 1 dim sum + 1 drink.

Bundles must support options at bundle level and, where configured, options/notes for selected child items.

## Cart v2 model

A cart line has a unique `lineId`; `itemId` alone is not a cart identity because the same menu item can be ordered with different options/notes.

Line types:

- `item`
- `bundle`

A line stores client-side display snapshots for UX only. Final prices and validity are always recalculated/validated by the Worker from authoritative database records.

## Server validation

The `/order` Worker must validate all of the following before creating an order:

- menu item belongs to the requested shop;
- item is available;
- option group is attached/applicable to the item/bundle;
- selected option exists and is active;
- min/max selection rules are satisfied;
- option price deltas come from DB, never the browser;
- bundle selection groups and quantities are satisfied;
- selected bundle child products are eligible and available;
- fulfillment and requested time are allowed;
- delivery fee is server-authoritative;
- final item/order snapshots are written for historical accuracy.

## Order/rider state rules

`pending` means the customer submitted successfully but the shop has not accepted yet.

Existing lifecycle remains compatible:

- pending → confirmed → preparing → completed/cancelled
- delivery status remains separate.

For Delivery, the shop chooses a rider manually from the directory. No automatic matching, claim board, or dispatch logic is introduced.
