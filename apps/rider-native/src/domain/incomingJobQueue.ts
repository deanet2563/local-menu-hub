export type IncomingJobLike = {
  sub_id: string;
  offer_requested_at: string | null;
  confirmed_at: string | null;
};

export type IncomingJobQueueState<T extends IncomingJobLike> = {
  active: T | null;
  queued: T[];
  dismissedIds: string[];
};

function offerTime(job: IncomingJobLike): number {
  const raw = job.offer_requested_at ?? job.confirmed_at;
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function sortIncomingJobs<T extends IncomingJobLike>(jobs: T[]): T[] {
  return [...jobs].sort((a, b) => {
    const timeDelta = offerTime(a) - offerTime(b);
    return timeDelta === 0 ? a.sub_id.localeCompare(b.sub_id) : timeDelta;
  });
}

export function reconcileIncomingJobQueue<T extends IncomingJobLike>(
  current: IncomingJobQueueState<T>,
  jobs: T[],
): IncomingJobQueueState<T> {
  const dismissed = new Set(current.dismissedIds);
  const available = sortIncomingJobs(jobs.filter((job) => !dismissed.has(job.sub_id)));
  const active = current.active
    ? available.find((job) => job.sub_id === current.active?.sub_id) ?? null
    : null;

  const nextActive = active ?? available[0] ?? null;
  const queued = nextActive
    ? available.filter((job) => job.sub_id !== nextActive.sub_id)
    : [];

  return {
    active: nextActive,
    queued,
    dismissedIds: current.dismissedIds.filter((id) => jobs.some((job) => job.sub_id === id)),
  };
}

export function dismissActiveIncomingJob<T extends IncomingJobLike>(
  current: IncomingJobQueueState<T>,
): IncomingJobQueueState<T> {
  if (!current.active) return current;
  const dismissedIds = [...current.dismissedIds, current.active.sub_id];
  const [nextActive, ...queued] = current.queued;
  return {
    active: nextActive ?? null,
    queued,
    dismissedIds,
  };
}
