import { requireNativeModule } from 'expo';

type LineLoginResult = {
  idToken: string;
};

type MyTreeLineLoginModule = {
  login(): Promise<LineLoginResult>;
  logout(): Promise<void>;
};

let cached: MyTreeLineLoginModule | null = null;

function module(): MyTreeLineLoginModule {
  if (!cached) cached = requireNativeModule<MyTreeLineLoginModule>('MyTreeLineLogin');
  return cached;
}

export async function loginWithLineNative(): Promise<LineLoginResult> {
  const result = await module().login();
  if (!result?.idToken) throw new Error('LINE native login did not return an ID token');
  return result;
}

export async function logoutLineNative(): Promise<void> {
  await module().logout();
}
