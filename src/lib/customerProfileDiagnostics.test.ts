import {
  CUSTOMER_PROFILE_TIMEOUT_CODE,
  customerProfileTimeoutMessage,
  makeCustomerProfileTimelineEvent,
  type CustomerProfileTimelineStep,
} from "@/lib/customerProfileDiagnostics";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

const startedAt = 1_000;
const event = makeCustomerProfileTimelineEvent("liff_ready_wait_started", startedAt, () => 1_125);

assertEqual(event.step, "liff_ready_wait_started" satisfies CustomerProfileTimelineStep, "event records step");
assertEqual(event.elapsedMs, 125, "event records elapsed time");
assertEqual(event.detail, undefined, "event omits missing detail");
assertEqual(CUSTOMER_PROFILE_TIMEOUT_CODE, "customer_profile_timeout", "timeout code is stable");
assertEqual(customerProfileTimeoutMessage().includes(CUSTOMER_PROFILE_TIMEOUT_CODE), true, "timeout message includes stable code");
