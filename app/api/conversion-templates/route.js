import { CONVERSION_TEMPLATES, isSafePublicImageUrl } from '@/lib/conversion-templates/catalog';
import { getWalletEnvironment, getPricedModel } from '@/lib/wallet/server';
import { isMuapiGenerationEnabled } from '@/lib/wallet/generation-policy';

export const dynamic = 'force-dynamic';

export async function GET() {
  let env = null;
  try { env = await getWalletEnvironment(); } catch { /* catálogo visible incluso sin D1 */ }
  const templates = await Promise.all(CONVERSION_TEMPLATES.map(async (template) => {
    const modelId = env?.[template.modelEnvKey];
    const referenceUrl = env?.[template.referenceEnvKey];
    let pricing = null;
    if (env?.WALLETS_DB && modelId) {
      try { pricing = await getPricedModel(env.WALLETS_DB, modelId); } catch { /* no mostrar precio inventado */ }
    }
    let compatible = false;
    if (pricing) {
      try {
        const allowed = JSON.parse(pricing.allowed_input_keys_json);
        const fixed = JSON.parse(pricing.fixed_options_json);
        compatible = allowed.includes('prompt') && allowed.includes('images_list') &&
          !Object.hasOwn(fixed, 'prompt') && !Object.hasOwn(fixed, 'images_list');
      } catch { compatible = false; }
    }
    return {
      id: template.id,
      name: template.name,
      category: template.category,
      preview_url: template.previewUrl,
      aspect_ratio: template.aspectRatio,
      price_cents: pricing?.customer_price_cents ?? null,
      available: Boolean(compatible && isSafePublicImageUrl(referenceUrl) && env?.MUAPI_API_KEY && isMuapiGenerationEnabled(env)),
      preview_available: true
    };
  }));
  return Response.json({ templates }, { headers: { 'Cache-Control': 'no-store' } });
}
