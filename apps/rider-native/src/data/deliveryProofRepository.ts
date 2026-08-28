import type { RiderSession } from '@/auth/session';

export type RiderV3CompleteResult = {
  ok: boolean;
  result: 'delivered' | 'already_delivered';
  subId: string;
  proofPath: string;
};

function supabaseConfig() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('Missing Supabase public configuration');
  return { url: url.replace(/\/$/, ''), anonKey };
}

function workerUrl() {
  const url = process.env.EXPO_PUBLIC_MYTREE_WORKER_URL;
  if (!url) throw new Error('Missing EXPO_PUBLIC_MYTREE_WORKER_URL');
  return url.replace(/\/$/, '');
}

function proofExtension(mimeType?: string | null): 'jpg' | 'png' | 'webp' {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'jpg';
}

function proofMimeType(mimeType?: string | null): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (mimeType === 'image/png') return 'image/png';
  if (mimeType === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

export async function uploadPrivateDeliveryProof(
  session: RiderSession,
  input: { subId: string; uri: string; mimeType?: string | null },
): Promise<string> {
  const { url, anonKey } = supabaseConfig();
  const extension = proofExtension(input.mimeType);
  const mimeType = proofMimeType(input.mimeType);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const proofPath = `${input.subId}/${filename}`;

  const localResponse = await fetch(input.uri);
  if (!localResponse.ok) throw new Error('delivery_proof_local_file_unavailable');
  const blob = await localResponse.blob();
  if (blob.size <= 0) throw new Error('delivery_proof_file_empty');
  if (blob.size > 5 * 1024 * 1024) throw new Error('delivery_proof_file_too_large');

  const encodedPath = proofPath.split('/').map(encodeURIComponent).join('/');
  const upload = await fetch(`${url}/storage/v1/object/delivery-proofs/${encodedPath}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': mimeType,
      'x-upsert': 'false',
    },
    body: blob,
  });

  if (!upload.ok) {
    const detail = await upload.text().catch(() => '');
    if (upload.status === 401 || upload.status === 403) throw new Error('delivery_proof_upload_not_authorized');
    throw new Error(`delivery_proof_upload_failed:${upload.status}:${detail.slice(0, 160)}`);
  }

  return proofPath;
}

export async function completeDeliveryV3(
  session: RiderSession,
  subId: string,
  proofPath: string,
): Promise<RiderV3CompleteResult> {
  const response = await fetch(`${workerUrl()}/rider/delivery/complete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subId, proofPath }),
  });

  const payload = await response.json().catch(() => null) as RiderV3CompleteResult | { error?: string } | null;
  if (!response.ok) {
    const error = payload && 'error' in payload ? payload.error : undefined;
    throw new Error(error || `Rider V3 complete failed: ${response.status}`);
  }

  return payload as RiderV3CompleteResult;
}
