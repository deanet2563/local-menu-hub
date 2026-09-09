import { isSessionFresh, loadRiderSession, type RiderSession } from '@/auth/session';
import { riderFeatures } from '@/config/features';
import { listNearbyDeliveryJobs, type NearbyDeliveryJob } from '@/data/nearbyJobsRepository';
import { getRiderProfile } from '@/data/riderRepository';
import {
  reconcileIncomingJobQueue,
  sortIncomingJobs,
  type IncomingJobQueueState,
} from '@/domain/incomingJobQueue';

export const RIDER_INCOMING_JOB_RADII = [1, 2, 3, 5] as const;

export type IncomingOfferHydrationResult = {
  ok: boolean;
  session: RiderSession | null;
  jobs: NearbyDeliveryJob[];
  queue: IncomingJobQueueState<NearbyDeliveryJob>;
  message: string | null;
};

export const emptyIncomingJobQueue: IncomingJobQueueState<NearbyDeliveryJob> = {
  active: null,
  queued: [],
  dismissedIds: [],
  isViewingList: false,
};

export async function loadOnlineRiderSession(): Promise<{ session: RiderSession | null; message: string | null }> {
  if (!riderFeatures.deliveryV3Accept) {
    return { session: null, message: 'Delivery V3 ยังไม่เปิดใน build นี้' };
  }

  const saved = await loadRiderSession();
  if (!saved || !isSessionFresh(saved)) {
    return { session: null, message: 'ต้องเข้าสู่ระบบ Rider ก่อนดูงานเข้า' };
  }

  const rider = await getRiderProfile(saved);
  if (!rider?.is_online) {
    return { session: saved, message: 'เปิด Online ที่หน้าหลักก่อนรับงาน' };
  }

  return { session: saved, message: null };
}

export async function hydrateIncomingOffers(
  currentQueue: IncomingJobQueueState<NearbyDeliveryJob>,
  input: { session?: RiderSession | null; radiusKm?: number; focusSubId?: string | null } = {},
): Promise<IncomingOfferHydrationResult> {
  const sessionResult = input.session
    ? { session: input.session, message: null }
    : await loadOnlineRiderSession();

  if (!sessionResult.session || sessionResult.message) {
    return {
      ok: false,
      session: sessionResult.session,
      jobs: [],
      queue: currentQueue,
      message: sessionResult.message,
    };
  }

  const radiusKm = input.radiusKm ?? RIDER_INCOMING_JOB_RADII[0];
  const jobs = sortIncomingJobs(await listNearbyDeliveryJobs(sessionResult.session, radiusKm));
  const reconciled = reconcileIncomingJobQueue(currentQueue, jobs);

  if (input.focusSubId && reconciled.active?.sub_id !== input.focusSubId) {
    const focusJob = jobs.find((job) => job.sub_id === input.focusSubId);
    if (focusJob) {
      return {
        ok: true,
        session: sessionResult.session,
        jobs,
        queue: {
          ...reconciled,
          active: focusJob,
          queued: jobs.filter((job) => job.sub_id !== focusJob.sub_id),
          isViewingList: false,
        },
        message: null,
      };
    }
  }

  return {
    ok: true,
    session: sessionResult.session,
    jobs,
    queue: reconciled,
    message: jobs.length ? null : `ยังไม่มีงานในระยะ ${radiusKm} กม.`,
  };
}
