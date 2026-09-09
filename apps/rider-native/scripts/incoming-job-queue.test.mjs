import assert from 'node:assert/strict';

import {
  dismissActiveIncomingJob,
  reconcileIncomingJobQueue,
  sortIncomingJobs,
} from '../src/domain/incomingJobQueue.ts';
import { extractRiderOfferSubId } from '../src/domain/riderNotificationPayload.ts';
import { summarizeTodayRiderWork } from '../src/domain/riderDashboardState.ts';

function job(sub_id, offer_requested_at) {
  return { sub_id, offer_requested_at, confirmed_at: null };
}

const empty = { active: null, queued: [], dismissedIds: [], isViewingList: false };

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

assert.equal(extractRiderOfferSubId({ subId: 'sub-1' }), 'sub-1');
assert.equal(extractRiderOfferSubId({ sub_id: 'sub-2' }), 'sub-2');
assert.equal(extractRiderOfferSubId({ url: 'mytreerider://nearby-jobs?subId=sub-3' }), 'sub-3');
assert.equal(extractRiderOfferSubId({ deepLink: 'mytreerider://nearby-jobs?sub_order_id=sub-4' }), 'sub-4');
assert.equal(extractRiderOfferSubId({ other: 'nope' }), null);

assert.deepEqual(
  summarizeTodayRiderWork([
    { delivery_fee: 20, delivery_distance_km: 2.2, delivered_at: '2026-09-09T03:00:00.000Z' },
    { delivery_fee: '12.5', delivery_distance_km: '1.1', delivered_at: '2026-09-09T10:00:00.000Z' },
    { delivery_fee: 99, delivery_distance_km: 9, delivered_at: '2026-09-08T10:00:00.000Z' },
    { delivery_fee: null, delivery_distance_km: null, delivered_at: null },
  ], '2026-09-09'),
  { earnings: 32.5, completedJobs: 2, distanceKm: 3.3 },
);
