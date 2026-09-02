export const LINE_RETURN_PATH_TTL_MS = 10 * 60 * 1000;
const LINE_RETURN_PATH_KEY = "mytree.lineReturnPath.v1";
const LINE_RECOVERY_ATTEMPT_KEY = "mytree.lineRecoveryAttempt.v1";
const LINE_RECOVERY_ATTEMPT_WINDOW_MS = 2 * 60 * 1000;

type StoredReturnPath = {
  path: string;
  expiresAt: number;
};

export type LineSessionRecoveryReason = "missing_login" | "missing_id_token" | "expired_or_invalid";

export class LineSessionAuthError extends Error {
  readonly reason: LineSessionRecoveryReason;

  constructor(reason: LineSessionRecoveryReason, message = "LINE session needs recovery") {
    super(message);
    this.name = "LineSessionAuthError";
    this.reason = reason;
  }
}

export function isLineSessionAuthError(cause: unknown): cause is LineSessionAuthError {
  return cause instanceof LineSessionAuthError;
}

export function sanitizeLineReturnPath(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;

  let decoded = raw;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    const withoutLeadingSlash = decoded.startsWith("/") ? decoded.slice(1) : decoded;
    if (
      decoded.startsWith("//")
      || decoded.includes("\\")
      || /^[a-z][a-z0-9+.-]*:/i.test(decoded)
      || /^[a-z][a-z0-9+.-]*:/i.test(withoutLeadingSlash)
      || withoutLeadingSlash.startsWith("//")
    ) {
      return null;
    }
  }

  try {
    const url = new URL(raw, "https://mytree.local");
    if (url.origin !== "https://mytree.local") return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function currentLineReturnPath(): string {
  if (typeof window === "undefined") return "/";
  return sanitizeLineReturnPath(`${window.location.pathname}${window.location.search}${window.location.hash}`) ?? "/";
}

export function hasValidCheckoutSession(authState: string, customerId: string | null): boolean {
  return authState === "valid" && typeof customerId === "string" && customerId.length > 0;
}

export function readLineReturnPath(input?: { raw?: string | null; now?: number }): string | null {
  const raw = input?.raw ?? (typeof window !== "undefined" ? window.sessionStorage.getItem(LINE_RETURN_PATH_KEY) : null);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredReturnPath>;
    const now = input?.now ?? Date.now();
    if (typeof parsed.path !== "string" || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= now) return null;
    return sanitizeLineReturnPath(parsed.path);
  } catch {
    return null;
  }
}

export function storeLineReturnPath(path = currentLineReturnPath(), now = Date.now()): string | null {
  const safePath = sanitizeLineReturnPath(path);
  if (!safePath || typeof window === "undefined") return safePath;
  const payload: StoredReturnPath = { path: safePath, expiresAt: now + LINE_RETURN_PATH_TTL_MS };
  window.sessionStorage.setItem(LINE_RETURN_PATH_KEY, JSON.stringify(payload));
  return safePath;
}

export function consumeLineReturnPath(input?: { raw?: string | null; now?: number }): { path: string | null; shouldClear: boolean } {
  const path = readLineReturnPath(input);
  if (typeof window !== "undefined" && input?.raw === undefined) window.sessionStorage.removeItem(LINE_RETURN_PATH_KEY);
  return { path, shouldClear: true };
}

export function shouldAttemptLineSessionRecovery(input: { attemptedAt: number | null; now?: number }): boolean {
  if (input.attemptedAt === null) return true;
  const now = input.now ?? Date.now();
  return now - input.attemptedAt > LINE_RECOVERY_ATTEMPT_WINDOW_MS;
}

export function readLineSessionRecoveryAttempt(now = Date.now()): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(LINE_RECOVERY_ATTEMPT_KEY);
  if (!raw) return null;
  const attemptedAt = Number(raw);
  if (!Number.isFinite(attemptedAt) || shouldAttemptLineSessionRecovery({ attemptedAt, now })) {
    window.sessionStorage.removeItem(LINE_RECOVERY_ATTEMPT_KEY);
    return null;
  }
  return attemptedAt;
}

export function markLineSessionRecoveryAttempt(now = Date.now()): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(LINE_RECOVERY_ATTEMPT_KEY, String(now));
}

export function clearLineSessionRecoveryAttempt(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(LINE_RECOVERY_ATTEMPT_KEY);
}

export const lineSessionRecoveryCompileChecks = {
  ttl: LINE_RETURN_PATH_TTL_MS,
  safeCart: sanitizeLineReturnPath("/cart"),
  safeCartQuery: sanitizeLineReturnPath("/cart?source=shop"),
  unsafeExternal: sanitizeLineReturnPath("https://evil.example"),
  unsafeProtocolRelative: sanitizeLineReturnPath("//evil.example"),
  unsafeEncodedExternal: sanitizeLineReturnPath("/%2F%2Fevil.example"),
};
