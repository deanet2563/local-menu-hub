const HASHED_PAGES_PREVIEW_HOST = /^[a-f0-9]{8}\.local-menu-hub\.pages\.dev$/;
const CHECKOUT_MAP_DEBUG_PATH = "/debug/checkout-map";
export const CHECKOUT_MAP_DEBUG_BLOCKED_HOSTS = ["mytree.cc", "www.mytree.cc", "local-menu-hub.pages.dev"] as const;
export const COMMUNITY_RC_PREVIEW_HOSTNAME = "community-rc.local-menu-hub.pages.dev";
const LOCAL_COMMUNITY_HOSTS = new Set(["localhost", "127.0.0.1"]);

export type CommunityFixturePreviewDecision = "allow" | "redirect-community" | "deny";

export function isPrivateLanIpv4Hostname(hostname: string): boolean {
  const octets = hostname.split(".");
  if (octets.length !== 4) return false;
  if (!octets.every((octet) => /^(0|[1-9]\d{0,2})$/.test(octet))) return false;

  const values = octets.map(Number);
  if (values.some((octet) => octet > 255)) return false;

  const [first, second] = values;
  return (
    first === 10
    || (first === 172 && second !== undefined && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
  );
}

export function isLocalCommunityPrototypeHost(hostname: string): boolean {
  return LOCAL_COMMUNITY_HOSTS.has(hostname) || isPrivateLanIpv4Hostname(hostname);
}

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

export function isLocalCommunityPrototypeAuthBypassLocation(
  location: Pick<Location, "hostname" | "pathname">,
  isDev = import.meta.env.DEV === true,
): boolean {
  return (
    isDev
    && isLocalCommunityPrototypeHost(location.hostname)
    && isLocalCommunityPrototypePath(location.pathname)
  );
}

export function isLocalCommunityPrototypeAuthBypassActive(): boolean {
  return typeof window !== "undefined" && isLocalCommunityPrototypeAuthBypassLocation(window.location);
}

export function getCommunityFixturePreviewDecision({
  fixturePreviewEnabled,
  hostname,
  pathname,
}: {
  fixturePreviewEnabled: boolean;
  hostname: string;
  pathname: string;
}): CommunityFixturePreviewDecision {
  if (!fixturePreviewEnabled || hostname !== COMMUNITY_RC_PREVIEW_HOSTNAME) return "deny";
  return isLocalCommunityPrototypePath(pathname) ? "allow" : "redirect-community";
}

export function getActiveCommunityFixturePreviewDecision(): CommunityFixturePreviewDecision {
  if (typeof window === "undefined") return "deny";
  return getCommunityFixturePreviewDecision({
    fixturePreviewEnabled: import.meta.env.VITE_COMMUNITY_FIXTURE_PREVIEW === "true",
    hostname: window.location.hostname,
    pathname: window.location.pathname,
  });
}

export function isPublicCommunityFixturePreviewAuthBypassActive(): boolean {
  return getActiveCommunityFixturePreviewDecision() === "allow";
}
