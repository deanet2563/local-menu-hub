# MyTree Rider — Temporary Security Exceptions

## SEC-2026-08-13-01 — `image-size` via Metro/Expo build toolchain

Status: **Temporary accepted build-tool risk; production release review required**

Observed during `npm audit --omit=dev` on Expo SDK 57 / React Native 0.86.2.

GitHub reviewed advisories:

- `GHSA-w3rx-r6r6-pgpr` — malformed ICNS can cause an infinite loop / denial of service
- `GHSA-5p2g-fcmc-qvqq` — malformed JXL/HEIF can cause infinite loops / denial of service

As reviewed on 2026-08-13, GitHub lists `image-size <= 2.0.2` as affected and lists **no patched version** for these two advisories.

### Why this is not silently ignored

The audit graph reaches `image-size` through Metro / Expo / React Native build tooling. MyTree Rider application code does not directly import `image-size`.

The known exploit condition requires a crafted image to be parsed by the vulnerable package. Our build pipeline must therefore treat repository/build assets as trusted inputs and must not feed user-uploaded proof/customer images into Metro or `image-size` processing.

### Current controls

1. No user-uploaded delivery image is processed by Metro during app build.
2. No remote image-processing endpoint using `image-size` is part of MyTree Rider.
3. `scripts/audit-production.mjs` resolves the npm vulnerability graph and allows only these explicitly recorded high-severity advisory leaves.
4. Any other high/critical advisory causes CI failure.
5. Do not use `npm audit fix --force` to downgrade Expo/React Native merely to silence this report.

### Exit criteria

Remove this exception when any of the following occurs:

- Expo / React Native / Metro moves to a dependency chain without the affected `image-size` version;
- a patched `image-size` release becomes compatible with the current Metro dependency chain;
- MyTree changes build processing in a way that exposes untrusted images to the vulnerable parser.

Re-check this exception before every production store release and no later than 2026-09-01.
