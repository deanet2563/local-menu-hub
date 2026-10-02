/** Resolve the same-origin destination carried by LINE's Customer LIFF state. */
export function parseCustomerLiffStateDestination(search: string, origin: string): string | null {
  const state = new URLSearchParams(search).get("liff.state");
  if (!state) return null;

  let destination = state;
  // URLSearchParams decodes the normal LIFF state once. Accept a second level
  // only when the destination itself is still encoded.
  if (!destination.startsWith("/") && /^(?:%2f|%23|%3f)/i.test(destination)) {
    try {
      destination = decodeURIComponent(destination);
    } catch {
      return null;
    }
  }

  try {
    const url = new URL(destination, origin);
    if (url.origin !== new URL(origin).origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

const MYTREE_CANONICAL_ORIGIN = "https://mytree.cc";

/** Build a canonical URL without allowing a pathname to replace its origin. */
export function buildCanonicalMyTreeUrl(pathname: string, search = "", hash = ""): string {
  const target = new URL(MYTREE_CANONICAL_ORIGIN);
  target.pathname = pathname || "/";
  target.search = search;
  target.hash = hash;

  if (target.origin !== MYTREE_CANONICAL_ORIGIN) {
    throw new Error("canonical_mytree_origin_invariant_failed");
  }
  return target.toString();
}
