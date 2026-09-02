# Backlog

## P0 Auth / Preview Testing

- LINE Login must preserve the original deep-link path and query string through authentication redirects.
- Cloudflare Pages preview testing needs a stable authenticated strategy that does not require modifying production LINE configuration.
- Context: hashed preview domains redirect repeatedly during `/cart?mapDebug=1` real-device testing, preventing checkout-map diagnostics from loading in LINE.
- Non-goal for merchant marker task: do not weaken `/cart` authentication or change production LINE settings.
