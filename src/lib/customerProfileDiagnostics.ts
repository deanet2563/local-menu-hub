export type CustomerProfileTimelineStep =
  | "customer_profile_function_entered"
  | "liff_ready_wait_started"
  | "liff_ready_wait_resolved"
  | "liff_is_logged_in"
  | "liff_context_read"
  | "customer_identity_read_started"
  | "customer_identity_read_resolved"
  | "supabase_customer_query_started"
  | "supabase_customer_query_resolved"
  | "customer_profile_found"
  | "customer_profile_missing"
  | "customer_profile_error"
  | "customer_profile_function_returned"
  | "customer_profile_timeout";

export type CustomerProfileTimelineEvent = {
  step: CustomerProfileTimelineStep;
  at: string;
  elapsedMs: number;
  detail?: string;
};

export const CUSTOMER_PROFILE_TIMEOUT_CODE = "customer_profile_timeout";

export function customerProfileTimeoutMessage(): string {
  return `customer_profile_timeout: หมดเวลารอข้อมูลลูกค้า staging กรุณาดู customer profile timeline`;
}

export function makeCustomerProfileTimelineEvent(
  step: CustomerProfileTimelineStep,
  startedAt: number,
  now: () => number = () => Date.now(),
  detail?: string,
): CustomerProfileTimelineEvent {
  return {
    step,
    at: new Date(now()).toISOString(),
    elapsedMs: now() - startedAt,
    detail,
  };
}
