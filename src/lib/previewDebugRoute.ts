const HASHED_PAGES_PREVIEW_HOST = /^[a-f0-9]{8}\.local-menu-hub\.pages\.dev$/;
const CHECKOUT_MAP_DEBUG_PATH = "/debug/checkout-map";
const LINE_SESSION_RECOVERY_DEBUG_PATH = "/debug/line-session-recovery";
const PREVIEW_DEBUG_AUTH_BYPASS_PATHS = [CHECKOUT_MAP_DEBUG_PATH, LINE_SESSION_RECOVERY_DEBUG_PATH] as const;
export const CHECKOUT_MAP_DEBUG_BLOCKED_HOSTS = ["mytree.cc", "www.mytree.cc", "local-menu-hub.pages.dev"] as const;

export function isHashedCloudflarePreviewHost(hostname: string): boolean {
  return HASHED_PAGES_PREVIEW_HOST.test(hostname);
}

export function isCheckoutMapDebugPath(pathname: string): boolean {
  return pathname === CHECKOUT_MAP_DEBUG_PATH;
}

export function isPreviewDebugAuthBypassPath(pathname: string): boolean {
  return PREVIEW_DEBUG_AUTH_BYPASS_PATHS.includes(pathname as typeof PREVIEW_DEBUG_AUTH_BYPASS_PATHS[number]);
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

export function isPreviewDebugAuthBypassLocation(location: Pick<Location, "hostname" | "pathname">): boolean {
  return isCheckoutMapDebugRouteAllowedHost(location.hostname) && isPreviewDebugAuthBypassPath(location.pathname);
}

export function isPreviewCheckoutMapAuthBypassActive(): boolean {
  return typeof window !== "undefined" && isPreviewCheckoutMapAuthBypassLocation(window.location);
}

export function isPreviewDebugAuthBypassActive(): boolean {
  return typeof window !== "undefined" && isPreviewDebugAuthBypassLocation(window.location);
}
