function normalizeJob(job) {
  if (!job || typeof job.sub_id !== 'string') return null;
  return job;
}

function snapshot(jobs, isViewingList = false) {
  const normalizedJobs = jobs.filter(Boolean);
  return {
    jobs: normalizedJobs,
    current: normalizedJobs[0] ?? null,
    pendingCount: Math.max(normalizedJobs.length - 1, 0),
    isViewingList,
    shouldLoopSound: normalizedJobs.length > 0,
  };
}

function createIncomingJobQueue() {
  return snapshot([]);
}

function enqueueIncomingJobs(queue, incomingJobs) {
  const existing = new Set((queue?.jobs ?? []).map((job) => job.sub_id));
  const next = [...(queue?.jobs ?? [])];
  for (const rawJob of incomingJobs ?? []) {
    const job = normalizeJob(rawJob);
    if (!job || existing.has(job.sub_id)) continue;
    existing.add(job.sub_id);
    next.push(job);
  }
  return snapshot(next, queue?.isViewingList === true);
}

function viewIncomingQueue(queue) {
  return snapshot(queue?.jobs ?? [], true);
}

function focusCurrentIncomingJob(queue) {
  return snapshot(queue?.jobs ?? [], false);
}

function resolveCurrentIncomingJob(queue) {
  return snapshot((queue?.jobs ?? []).slice(1), false);
}

function removeIncomingJob(queue, subId) {
  return snapshot((queue?.jobs ?? []).filter((job) => job.sub_id !== subId), queue?.isViewingList === true);
}

module.exports = {
  createIncomingJobQueue,
  enqueueIncomingJobs,
  viewIncomingQueue,
  focusCurrentIncomingJob,
  resolveCurrentIncomingJob,
  removeIncomingJob,
};
