const assert = require('node:assert/strict');
const test = require('node:test');

const { summarizeTodayRiderWork } = require('./riderDashboardState');

test('summarizes delivered rider work for the requested local day', () => {
  const summary = summarizeTodayRiderWork([
    { delivery_fee: 42, delivery_distance_km: 3.2, delivered_at: '2026-09-06T02:30:00.000Z' },
    { delivery_fee: 38, delivery_distance_km: 1.4, delivered_at: '2026-09-06T14:00:00.000Z' },
    { delivery_fee: 99, delivery_distance_km: 9.9, delivered_at: '2026-09-05T14:00:00.000Z' },
  ], '2026-09-06');

  assert.equal(summary.earnings, 80);
  assert.equal(summary.completedJobs, 2);
  assert.equal(summary.distanceKm, 4.6);
});

test('ignores rows without a completed timestamp', () => {
  const summary = summarizeTodayRiderWork([
    { delivery_fee: 42, delivery_distance_km: 3.2, delivered_at: null },
  ], '2026-09-06');

  assert.deepEqual(summary, { earnings: 0, completedJobs: 0, distanceKm: 0 });
});
