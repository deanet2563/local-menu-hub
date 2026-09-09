import assert from 'node:assert/strict';

import {
  dismissActiveIncomingJob,
  reconcileIncomingJobQueue,
  sortIncomingJobs,
} from '../src/domain/incomingJobQueue.ts';

function job(sub_id, offer_requested_at) {
  return { sub_id, offer_requested_at, confirmed_at: null };
}

const empty = { active: null, queued: [], dismissedIds: [] };

assert.deepEqual(
  sortIncomingJobs([
    job('newer', '2026-09-09T08:00:02.000Z'),
    job('older', '2026-09-09T08:00:01.000Z'),
  ]).map((item) => item.sub_id),
  ['older', 'newer'],
  'oldest incoming offer must be selected first',
);

const firstBatch = reconcileIncomingJobQueue(empty, [
  job('offer-2', '2026-09-09T08:00:02.000Z'),
  job('offer-1', '2026-09-09T08:00:01.000Z'),
]);

assert.equal(firstBatch.active?.sub_id, 'offer-1');
assert.deepEqual(firstBatch.queued.map((item) => item.sub_id), ['offer-2']);

const secondBatch = reconcileIncomingJobQueue(firstBatch, [
  job('offer-3', '2026-09-09T08:00:00.000Z'),
  job('offer-1', '2026-09-09T08:00:01.000Z'),
  job('offer-2', '2026-09-09T08:00:02.000Z'),
]);

assert.equal(secondBatch.active?.sub_id, 'offer-1', 'active offer must remain stable while visible');
assert.deepEqual(secondBatch.queued.map((item) => item.sub_id), ['offer-3', 'offer-2']);

const rejected = dismissActiveIncomingJob(secondBatch);
assert.equal(rejected.active?.sub_id, 'offer-3');
assert.deepEqual(rejected.queued.map((item) => item.sub_id), ['offer-2']);
assert.deepEqual(rejected.dismissedIds, ['offer-1']);

const afterBackendRefresh = reconcileIncomingJobQueue(rejected, [
  job('offer-1', '2026-09-09T08:00:01.000Z'),
  job('offer-2', '2026-09-09T08:00:02.000Z'),
  job('offer-3', '2026-09-09T08:00:00.000Z'),
]);

assert.equal(afterBackendRefresh.active?.sub_id, 'offer-3', 'locally rejected offer must not immediately re-open');
assert.deepEqual(afterBackendRefresh.queued.map((item) => item.sub_id), ['offer-2']);
