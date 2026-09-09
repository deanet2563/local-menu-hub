const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createIncomingJobQueue,
  enqueueIncomingJobs,
  viewIncomingQueue,
  resolveCurrentIncomingJob,
} = require('./incomingJobQueue');

test('viewing incoming jobs keeps the first job as alert sound owner', () => {
  const initial = createIncomingJobQueue();
  const queued = enqueueIncomingJobs(initial, [
    { sub_id: 'job-a', shop_name: 'ร้านแรก' },
    { sub_id: 'job-b', shop_name: 'ร้านสอง' },
  ]);

  const viewed = viewIncomingQueue(queued);

  assert.equal(viewed.current.sub_id, 'job-a');
  assert.equal(viewed.pendingCount, 1);
  assert.equal(viewed.isViewingList, true);
  assert.equal(viewed.shouldLoopSound, true);
});

test('accepting or rejecting the first incoming job advances to the next queued offer', () => {
  const queued = enqueueIncomingJobs(createIncomingJobQueue(), [
    { sub_id: 'job-a', shop_name: 'ร้านแรก' },
    { sub_id: 'job-b', shop_name: 'ร้านสอง' },
  ]);

  const advanced = resolveCurrentIncomingJob(queued);
  const empty = resolveCurrentIncomingJob(advanced);

  assert.equal(advanced.current.sub_id, 'job-b');
  assert.equal(advanced.pendingCount, 0);
  assert.equal(advanced.shouldLoopSound, true);
  assert.equal(empty.current, null);
  assert.equal(empty.shouldLoopSound, false);
});

test('duplicate incoming jobs are ignored without disturbing the current owner', () => {
  const queued = enqueueIncomingJobs(createIncomingJobQueue(), [
    { sub_id: 'job-a', shop_name: 'ร้านแรก' },
  ]);

  const deduped = enqueueIncomingJobs(queued, [
    { sub_id: 'job-a', shop_name: 'ร้านแรกซ้ำ' },
    { sub_id: 'job-b', shop_name: 'ร้านสอง' },
  ]);

  assert.equal(deduped.current.sub_id, 'job-a');
  assert.equal(deduped.pendingCount, 1);
  assert.deepEqual(deduped.jobs.map((job) => job.sub_id), ['job-a', 'job-b']);
});
