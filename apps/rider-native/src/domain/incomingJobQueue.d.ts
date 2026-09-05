export type IncomingQueueJob = {
  sub_id: string;
  [key: string]: unknown;
};

export type IncomingJobQueue<T extends IncomingQueueJob> = {
  jobs: T[];
  current: T | null;
  pendingCount: number;
  isViewingList: boolean;
  shouldLoopSound: boolean;
};

export function createIncomingJobQueue<T extends IncomingQueueJob>(): IncomingJobQueue<T>;
export function enqueueIncomingJobs<T extends IncomingQueueJob>(queue: IncomingJobQueue<T>, incomingJobs: T[]): IncomingJobQueue<T>;
export function viewIncomingQueue<T extends IncomingQueueJob>(queue: IncomingJobQueue<T>): IncomingJobQueue<T>;
export function focusCurrentIncomingJob<T extends IncomingQueueJob>(queue: IncomingJobQueue<T>): IncomingJobQueue<T>;
export function resolveCurrentIncomingJob<T extends IncomingQueueJob>(queue: IncomingJobQueue<T>): IncomingJobQueue<T>;
export function removeIncomingJob<T extends IncomingQueueJob>(queue: IncomingJobQueue<T>, subId: string): IncomingJobQueue<T>;
