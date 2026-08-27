---
name: mytree-ui-qa
description: Use for MyTree customer, Shop, Rider, ordering, map, and admin UI work; responsive bugs; Thai/English text; small-screen layout; loading/error/empty/offline states; and visual regression verification.
---

# MyTree UI QA

## Principle

A screen is not complete because it renders on one viewport. MyTree must work for real customers, shops, and Riders on small mobile screens and under imperfect network/permission conditions.

## Inspect first

1. Identify the exact route/component and its data dependencies.
2. Verify whether the bug is layout, state, data, permission, or backend truth.
3. Inspect existing approved flows before redesigning.
4. Prefer a minimal layout/state fix over unrelated visual refactors.

## Mandatory checks

For affected screens, verify as applicable:

- small Android viewport,
- vertical scrolling and bottom-content reachability,
- safe areas,
- Thai text wrapping/truncation,
- long shop/item/customer names,
- loading,
- empty state,
- error/retry,
- offline or stale data,
- permission denied,
- disabled/busy button state,
- duplicate tap prevention,
- status visibility,
- navigation back/resume behavior,
- keyboard overlap for editable forms.

## Product-specific rules

- Do not expose Shop/Rider operational role-switching UX in the customer LINE surface.
- Pre-order date/time must be prominent wherever the order summary is operationally relevant to Customer and Shop.
- Customer order history should retain access to useful payment/shop QR context when required by the product flow.
- Rider job cards/current job must remain reachable after readiness/location/status cards expand.
- Delivery assignment UI must reflect backend authoritative state.

## Verification

Use screenshots or physical-device evidence when visual behavior is central. Distinguish:

- source-level confidence,
- emulator/browser confidence,
- physical-device confidence.

Do not declare a native UI regression fixed until the changed build is tested on an appropriate device when the issue was device-specific.

## Completion report

State:

- viewport/device tested,
- before/after behavior,
- states checked,
- regressions intentionally avoided,
- any remaining physical-device gate.
