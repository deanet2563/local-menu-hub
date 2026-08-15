import { requireNativeModule } from 'expo-modules-core';

type LineLoginResult = {
  idToken: string;
};

type MyTreeLineLoginNative = {
  login(channelId: string): Promise<LineLoginResult>;
};

const nativeModule = requireNativeModule<MyTreeLineLoginNative>('MyTreeLineLogin');

export async function loginWithLine(channelId: string): Promise<LineLoginResult> {
  return nativeModule.login(channelId);
}
