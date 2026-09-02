import {
  consumeLineReturnPath,
  hasValidCheckoutSession,
  LINE_RETURN_PATH_TTL_MS,
  lineSessionRecoveryCompileChecks,
  readLineReturnPath,
  sanitizeLineReturnPath,
  shouldAttemptLineSessionRecovery,
  storeLineReturnPath,
} from "@/lib/lineSessionRecovery";

const now = new Date("2026-09-02T10:00:00.000Z").getTime();

export const lineSessionRecoveryTests = {
  validCart: sanitizeLineReturnPath("/cart") === "/cart",
  validCartQuery: sanitizeLineReturnPath("/cart?source=shop") === "/cart?source=shop",
  rejectsProtocolUrl: sanitizeLineReturnPath("https://evil.example") === null,
  rejectsProtocolRelativeUrl: sanitizeLineReturnPath("//evil.example") === null,
  rejectsJavascriptUrl: sanitizeLineReturnPath("javascript:alert(1)") === null,
  rejectsEncodedProtocolRelativeUrl: sanitizeLineReturnPath("/%2F%2Fevil.example") === null,
  rejectsEncodedProtocolUrl: sanitizeLineReturnPath("/https%3A%2F%2Fevil.example") === null,
  rejectsMalformedPath: sanitizeLineReturnPath("cart") === null,
  expiredReturnPath: readLineReturnPath({
    raw: JSON.stringify({ path: "/cart", expiresAt: now - 1 }),
    now,
  }) === null,
  validReturnPath: readLineReturnPath({
    raw: JSON.stringify({ path: "/cart", expiresAt: now + LINE_RETURN_PATH_TTL_MS }),
    now,
  }) === "/cart",
  consumeOnce: consumeLineReturnPath({
    raw: JSON.stringify({ path: "/cart?source=shop", expiresAt: now + LINE_RETURN_PATH_TTL_MS }),
    now,
  }).path === "/cart?source=shop",
  recoveryAttemptStartsAllowed: shouldAttemptLineSessionRecovery({ attemptedAt: null, now }) === true,
  recoveryAttemptPreventsLoop: shouldAttemptLineSessionRecovery({ attemptedAt: now - 1_000, now }) === false,
  submissionRequiresCurrentCustomer: hasValidCheckoutSession("valid", "customer-1") === true,
  submissionRejectsMissingCustomer: hasValidCheckoutSession("valid", null) === false,
  storageWriters: {
    store: typeof storeLineReturnPath,
    consume: typeof consumeLineReturnPath,
  },
  compileChecks: lineSessionRecoveryCompileChecks,
};
