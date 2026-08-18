import { useEffect, useMemo, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { exchangeLineCode } from './exchangeLineCode';
import { LINE_LOGIN_CHANNEL_ID, lineDiscovery, lineRedirectUri } from './lineConfig';

WebBrowser.maybeCompleteAuthSession();

export function useLineLogin(onSuccess: () => void) {
  const [nonce, setNonce] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);

  useEffect(() => {
    void Crypto.getRandomBytesAsync(24).then((bytes) => {
      setNonce(Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''));
    });
  }, []);

  const config = useMemo<AuthSession.AuthRequestConfig>(() => ({
    clientId: LINE_LOGIN_CHANNEL_ID,
    redirectUri: lineRedirectUri,
    scopes: ['openid', 'profile'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: nonce ? { nonce } : {},
  }), [nonce]);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(config, lineDiscovery);

  useEffect(() => {
    if (!response || response.type !== 'success' || !request || !nonce) return;
    const code = response.params.code;
    const codeVerifier = request.codeVerifier;
    if (!code || !codeVerifier) {
      setError('LINE Login did not return a valid authorization code.');
      return;
    }

    setExchanging(true);
    setError(null);
    void exchangeLineCode({ code, redirectUri: lineRedirectUri, codeVerifier, nonce })
      .then(() => onSuccess())
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'LINE Login failed'))
      .finally(() => setExchanging(false));
  }, [response, request, nonce, onSuccess]);

  return {
    ready: Boolean(request && nonce),
    exchanging,
    error,
    signIn: async () => {
      setError(null);
      await promptAsync();
    },
  };
}
