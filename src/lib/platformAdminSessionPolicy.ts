export type PlatformAdminIdTokenStatus = "valid" | "missing" | "expired" | "wrong_audience";

export interface DecodedLineIdToken {
  aud?: unknown;
  exp?: unknown;
}

export function getPlatformAdminIdTokenStatus(
  decoded: DecodedLineIdToken | null | undefined,
  expectedChannelId: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): PlatformAdminIdTokenStatus {
  if (!decoded) return "missing";
  if (!expectedChannelId || decoded.aud !== expectedChannelId) return "wrong_audience";
  if (typeof decoded.exp !== "number" || !Number.isFinite(decoded.exp)) return "missing";
  if (decoded.exp <= nowSeconds + 30) return "expired";
  return "valid";
}

export function mayStartPlatformAdminReauthentication(attempted: boolean): boolean {
  return !attempted;
}
