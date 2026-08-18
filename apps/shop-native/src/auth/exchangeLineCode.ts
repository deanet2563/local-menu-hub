import { MYTREE_API_URL } from './lineConfig';
import { setAccessToken } from '../lib/tokenStore';

export type NativeLineExchangeInput = {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  nonce: string;
};

type NativeLineExchangeResponse = {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  customer_id: string;
  is_new: boolean;
};

export async function exchangeLineCode(input: NativeLineExchangeInput): Promise<NativeLineExchangeResponse> {
  const response = await fetch(`${MYTREE_API_URL}/auth/line/native`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: input.code,
      redirectUri: input.redirectUri,
      codeVerifier: input.codeVerifier,
      nonce: input.nonce,
    }),
  });

  const payload = (await response.json().catch(() => null)) as NativeLineExchangeResponse | { error?: string; detail?: string } | null;
  if (!response.ok || !payload || !('access_token' in payload)) {
    const message = payload && 'error' in payload ? payload.detail || payload.error : null;
    throw new Error(message || `MyTree auth exchange failed (${response.status})`);
  }

  await setAccessToken(payload.access_token);
  return payload;
}
