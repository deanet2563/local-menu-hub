import Constants from 'expo-constants';

import { loginWithLine } from '../../modules/mytree-line-login';
import { rememberLineNonce } from '@/auth/lineNonce';

export async function nativeLineLogin() {
  const channelId = Constants.expoConfig?.extra?.lineLogin?.channelId as string | undefined;
  if (!channelId) throw new Error('Missing LINE Login channel ID');

  const result = await loginWithLine(channelId);
  rememberLineNonce(result.nonce);
  return result;
}
