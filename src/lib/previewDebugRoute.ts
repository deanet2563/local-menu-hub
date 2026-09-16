const HASHED_PAGES_PREVIEW_HOST = /^[a-f0-9]{8}\.local-menu-hub\.pages\.dev$/;
const CHECKOUT_MAP_DEBUG_PATH = "/debug/checkout-map";
export const CHECKOUT_MAP_DEBUG_BLOCKED_HOSTS = ["mytree.cc", "www.mytree.cc", "local-menu-hub.pages.dev"] as const;
const LOCAL_COMMUNITY_HOSTS = new Set(["localhost", "127.0.0.1"]);

export function isHashedCloudflarePreviewHost(hostname: string): boolean {
  return HASHED_PAGES_PREVIEW_HOST.test(hostname);
}

export function isCheckoutMapDebugPath(pathname: string): boolean {
  return pathname === CHECKOUT_MAP_DEBUG_PATH;
}

export function isCheckoutMapDebugRouteBlockedHost(hostname: string): boolean {
  return CHECKOUT_MAP_DEBUG_BLOCKED_HOSTS.includes(hostname as typeof CHECKOUT_MAP_DEBUG_BLOCKED_HOSTS[number]);
}

export function isCheckoutMapDebugRouteAllowedHost(hostname: string): boolean {
  return isHashedCloudflarePreviewHost(hostname) && !isCheckoutMapDebugRouteBlockedHost(hostname);
}

export function isPreviewCheckoutMapAuthBypassLocation(location: Pick<Location, "hostname" | "pathname">): boolean {
  return isCheckoutMapDebugRouteAllowedHost(location.hostname) && isCheckoutMapDebugPath(location.pathname);
}

export function isPreviewCheckoutMapAuthBypassActive(): boolean {
  return typeof window !== "undefined" && isPreviewCheckoutMapAuthBypassLocation(window.location);
}

export function isLocalCommunityPrototypePath(pathname: string): boolean {
  return pathname === "/community" || pathname.startsWith("/community/");
}

export function isLocalCommunityPrototypeAuthBypassLocation(location: Pick<Location, "hostname" | "pathname">): boolean {
  return (
    import.meta.env.DEV === true
    && LOCAL_COMMUNITY_HOSTS.has(location.hostname)
    && isLocalCommunityPrototypePath(location.pathname)
  );
}

export function isLocalCommunityPrototypeAuthBypassActive(): boolean {
  return typeof window !== "undefined" && isLocalCommunityPrototypeAuthBypassLocation(window.location);
}
