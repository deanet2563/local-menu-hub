import {
  loadMyTreeSession,
  saveMyTreeSession,
  clearMyTreeSession,
  type MyTreeSessionStorage,
} from "@/lib/mytreeSession";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function makeStorage(): MyTreeSessionStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

const storage = makeStorage();

saveMyTreeSession(storage, {
  accessToken: "access-token",
  accessExp: 2_000,
  refreshToken: "refresh-token",
  refreshExp: 3_000,
});

const stored = loadMyTreeSession(storage, 1_000);
assertEqual(stored?.accessToken, "access-token", "loads stored access token before expiry");
assertEqual(stored?.refreshToken, "refresh-token", "loads stored refresh token before expiry");

assertEqual(loadMyTreeSession(storage, 1_950), null, "treats near-expiry access token as unusable");

clearMyTreeSession(storage);
assertEqual(loadMyTreeSession(storage, 1_000), null, "clears stored session");
