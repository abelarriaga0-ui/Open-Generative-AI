export const RESEARCH_LIMIT_SECONDS = 180;
export const IMAGE_LIMIT_SECONDS = 600;

export function secondsAllowed(job) {
  const key = String(job?.idempotency_key || '');
  if (key.startsWith('image_research_v1_')) return RESEARCH_LIMIT_SECONDS;
  if (key.startsWith('image_create_v1_')) return IMAGE_LIMIT_SECONDS;
  return null;
}

export function shouldExpireImageJob(job, now = Date.now()) {
  if (!['reserved', 'submitted', 'unknown'].includes(job?.status)) return false;
  const limit = secondsAllowed(job);
  if (!limit) return false;
  const created = Date.parse(String(job.created_at || '').replace(' ', 'T') + 'Z');
  return Number.isFinite(created) && now >= created + limit * 1000;
}

export function imageExpiryReason(job) {
  return secondsAllowed(job) === RESEARCH_LIMIT_SECONDS
    ? 'image_research_timeout_3min'
    : 'image_generation_timeout_10min';
}
