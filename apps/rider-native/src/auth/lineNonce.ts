let pendingNonce: string | null = null;

export function rememberLineNonce(nonce: string) {
  pendingNonce = nonce;
}

export function consumeLineNonce() {
  const nonce = pendingNonce;
  pendingNonce = null;
  return nonce;
}
