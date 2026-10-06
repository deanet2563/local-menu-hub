/** Discovery can be browsed anonymously; transactional/account routes cannot. */
export function isPublicCustomerDiscoveryPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (["/", "/hub", "/map"].includes(path)) return true;
  const parts = path.split("/").filter(Boolean);
  return parts.length === 2 && parts[0] === "shop" && parts[1] !== "orders";
}
