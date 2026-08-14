# Open Source Provenance — MyTree Rider

## Policy

MyTree Rider is implemented as an independent MyTree application. Third-party projects may be studied for architecture and UX patterns, but code must not be copied into this app unless its license, attribution requirements, and provenance are recorded first.

## Enatega evaluation

Project reviewed: `enatega/food-delivery-multivendor`, Rider app.

License observed during audit: MIT.

Decision: **reference-only by default**.

Allowed without copying Enatega application code:

- study screen flow and architecture patterns
- use the same independently licensed upstream Expo / React Native packages
- implement equivalent MyTree-specific behavior independently

Requires explicit provenance entry before reuse:

- copied source files
- copied functions/components
- substantial adapted code blocks
- Enatega-owned assets

## Current imported Enatega application code

**None.**

## Standard upstream dependencies

The app will use independently maintained open-source packages such as React, React Native, Expo, Expo Router, Expo Notifications, Expo Location, Expo SecureStore, Expo Image Picker, and React Native Maps under their respective licenses.

Before production release, generate a complete dependency license inventory and include required notices in the distribution package and internal compliance record.
