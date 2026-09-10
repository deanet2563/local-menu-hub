import { shouldStartLiffLogin } from "@/lib/supabase";

type AuthParityCase = {
  name: string;
  isInClient: boolean;
  isLoggedIn: boolean;
  shouldLogin: boolean;
};

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

const cases: AuthParityCase[] = [
  {
    name: "in-client staging LIFF session starts LINE login when LIFF is not logged in",
    isInClient: true,
    isLoggedIn: false,
    shouldLogin: true,
  },
  {
    name: "in-client already logged-in session does not start LINE login again",
    isInClient: true,
    isLoggedIn: true,
    shouldLogin: false,
  },
  {
    name: "external browser keeps public preview behavior and does not force LINE login",
    isInClient: false,
    isLoggedIn: false,
    shouldLogin: false,
  },
];

for (const testCase of cases) {
  assertEqual(
    shouldStartLiffLogin(testCase),
    testCase.shouldLogin,
    testCase.name,
  );
}
