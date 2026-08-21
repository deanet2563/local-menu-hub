import { getValidLineIdToken } from '../auth/session';

const WORKER_URL = (process.env.EXPO_PUBLIC_MYTREE_WORKER_URL ?? '').replace(/\/$/, '');

export type RiderOfferResult = {
  ok: boolean;
  subId: string;
  usedRadiusKm: number;
  candidates: number;
};

export type RiderCandidate = {
  riderId: string;
  name: string;
  vehicleType: string | null;
  distanceKm: number | null;
  interestedAt: string;
  online: boolean;
};

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  if (!WORKER_URL) throw new Error('Missing EXPO_PUBLIC_MYTREE_WORKER_URL');
  const idToken = await getValidLineIdToken();
  if (!idToken) throw new Error('LINE session หมดอายุ กรุณาเข้าสู่ระบบใหม่');

  const response = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, idToken }),
  });

  const data = (await response.json()) as T & { error?: string; detail?: string };
  if (!response.ok) {
    throw new Error(data.error || data.detail || `Rider dispatch error ${response.status}`);
  }
  return data;
}

export function requestNearbyRiders(subId: string): Promise<RiderOfferResult> {
  return post<RiderOfferResult>('/rider-dispatch/offer', { subId });
}

export async function loadInterestedRiders(subId: string): Promise<RiderCandidate[]> {
  const result = await post<{ ok: boolean; candidates: RiderCandidate[] }>('/rider-dispatch/candidates', { subId });
  return result.candidates ?? [];
}

export function selectInterestedRider(subId: string, riderId: string): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>('/rider-dispatch/select', { subId, riderId });
}
