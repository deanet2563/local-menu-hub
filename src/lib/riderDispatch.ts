import liff from "@line/liff";
import { initLiff } from "@/lib/supabase";

const WORKER_URL = "https://mytree-worker.kompakorn-t.workers.dev";

export type RiderOfferResult = {
  ok: boolean;
  subId: string;
  usedRadiusKm: number;
  candidates: number;
  push: {
    requestedRiders: number;
    eligibleDevices: number;
    ticketsOk: number;
    ticketsError: number;
    disabledTokens: number;
  };
};

export type RiderCandidate = {
  riderId: string;
  name: string;
  vehicleType: string | null;
  distanceKm: number | null;
  interestedAt: string;
  online: boolean;
};

async function getLineIdToken(): Promise<string> {
  await initLiff();
  if (!liff.isLoggedIn()) {
    liff.login();
    throw new Error("กำลังเข้าสู่ระบบ LINE...");
  }
  const idToken = liff.getIDToken();
  if (!idToken) throw new Error("ไม่พบ LINE idToken");
  return idToken;
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const idToken = await getLineIdToken();
  const response = await fetch(`${WORKER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, idToken }),
  });
  const data = (await response.json()) as T & { error?: string; detail?: string };
  if (!response.ok) {
    throw new Error(data.error || data.detail || `Rider dispatch error ${response.status}`);
  }
  return data;
}

export function requestNearbyRiders(subId: string): Promise<RiderOfferResult> {
  return post<RiderOfferResult>("/rider-dispatch/offer", { subId });
}

export async function loadInterestedRiders(subId: string): Promise<RiderCandidate[]> {
  const result = await post<{ ok: boolean; candidates: RiderCandidate[] }>("/rider-dispatch/candidates", { subId });
  return result.candidates ?? [];
}

export function selectInterestedRider(subId: string, riderId: string): Promise<{ ok: boolean }> {
  return post<{ ok: boolean }>("/rider-dispatch/select", { subId, riderId });
}
