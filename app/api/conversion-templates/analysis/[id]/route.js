import { getWalletEnvironment, requireWalletUser, jsonError } from '@/lib/wallet/server';
import { findConversionTemplate } from '@/lib/conversion-templates/catalog';
import { loadApprovedAnalysis } from '@/lib/conversion-templates/analysis-result';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
    const { id } = await params;
    const templateId = new URL(request.url).searchParams.get('template_id');
    if (!findConversionTemplate(templateId)) return Response.json({ error: 'template_not_found' }, { status: 404 });
    const analysis = await loadApprovedAnalysis(
      env.WALLETS_DB, user.id, templateId, env.REALIZO_TEMPLATE_ANALYZER_MODEL_ID, id
    );
    return Response.json(analysis, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (/^(invalid_analysis_job|analysis_job_not_found|analysis_not_completed|analysis_result_unavailable|analysis_invalid_|analysis_forbidden_field|analysis_empty_result|analysis_result_invalid)$/.test(String(error.message))) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    return jsonError(error);
  }
}
