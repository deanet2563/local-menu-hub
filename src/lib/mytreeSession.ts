export type MyTreeSession = {
  accessToken: string;
  accessExp: number;
  refreshToken?: string;
  refreshExp?: number;
};

export type MyTreeSessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const STORAGE_KEY = "mytree.customer.session.v1";
const ACCESS_EXPIRY_SKEW_SECONDS = 60;

export function loadMyTreeSession(storage: MyTreeSessionStorage | null, nowSeconds = Math.floor(Date.now() / 1000)): MyTreeSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MyTreeSession>;
    if (!parsed.accessToken || !parsed.accessExp) return null;
    if (parsed.accessExp - ACCESS_EXPIRY_SKEW_SECONDS <= nowSeconds) return null;
    return {
      accessToken: parsed.accessToken,
      accessExp: parsed.accessExp,
      refreshToken: parsed.refreshToken,
      refreshExp: parsed.refreshExp,
    };
  } catch {
    return null;
  }
}

export function saveMyTreeSession(storage: MyTreeSessionStorage | null, session: MyTreeSession): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Storage can fail in private browsing; in-memory auth still works.
  }
}

export function clearMyTreeSession(storage: MyTreeSessionStorage | null): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function browserSessionStorage(): MyTreeSessionStorage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}
