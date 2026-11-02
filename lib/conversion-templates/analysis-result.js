import { parseApprovedChanges } from './analysis.js';

export async function loadApprovedAnalysis(db, userId, templateId, analyzerModelId, analysisJobId) {
  if (typeof analysisJobId !== 'string' || !/^[A-Za-z0-9-]{8,80}$/.test(analysisJobId)) {
    throw new Error('invalid_analysis_job');
  }
  const record = await db.prepare(
    'SELECT id, status, model_id, idempotency_key, result_json FROM generation_jobs WHERE id=? AND user_id=?'
  ).bind(analysisJobId, userId).first();
  if (!record || record.model_id !== analyzerModelId ||
      !record.idempotency_key.startsWith('analysis_' + templateId + '_')) {
    throw new Error('analysis_job_not_found');
  }
  if (record.status !== 'completed') throw new Error('analysis_not_completed');
  if (!record.result_json) throw new Error('analysis_result_unavailable');
  let result;
  try { result = JSON.parse(record.result_json); } catch { throw new Error('analysis_result_invalid'); }
  return parseApprovedChanges(result);
}
