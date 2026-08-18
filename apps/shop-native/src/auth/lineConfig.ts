import * as AuthSession from 'expo-auth-session';

export const LINE_LOGIN_CHANNEL_ID = process.env.EXPO_PUBLIC_LINE_LOGIN_CHANNEL_ID || '2010936243';
export const MYTREE_API_URL = process.env.EXPO_PUBLIC_MYTREE_API_URL || 'https://mytree-worker.kompakorn-t.workers.dev';

export const lineDiscovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://access.line.me/oauth2/v2.1/authorize',
};

export const lineRedirectUri = AuthSession.makeRedirectUri({
  scheme: 'mytreeshop',
  path: 'auth/line',
});
