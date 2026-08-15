import Constants from 'expo-constants';

import { loginWithLine } from '../../modules/mytree-line-login';

export async function nativeLineLogin() {
  const channelId = Constants.expoConfig?.extra?.lineLogin?.channelId as string | undefined;
  if (!channelId) throw new Error('Missing LINE Login channel ID');
  return loginWithLine(channelId);
}
