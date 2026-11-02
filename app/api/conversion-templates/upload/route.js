import { getWalletEnvironment, requireWalletUser, jsonError } from '@/lib/wallet/server';
import { enforceSameOrigin } from '@/lib/wallet/access-auth';
import { isConversionImageGenerationEnabled } from '@/lib/wallet/generation-policy';
import { isSafePublicImageUrl } from '@/lib/conversion-templates/catalog';

export const dynamic = 'force-dynamic';
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request) {
  if (!enforceSameOrigin(request)) return Response.json({ error: 'invalid_origin' }, { status: 403 });
  try {
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
    if (!isConversionImageGenerationEnabled(env)) {
      return Response.json({ error: 'image_generation_not_configured' }, { status: 503 });
    }
    if (!env.MUAPI_API_KEY) return Response.json({ error: 'muapi_secret_not_configured' }, { status: 503 });
    if (Number(request.headers.get('content-length') || 0) > MAX_BYTES + 8192) {
      return Response.json({ error: 'image_too_large' }, { status: 413 });
    }
    const multipart = await request.formData();
    const file = multipart.get('product');
    if (!file || typeof file.arrayBuffer !== 'function' || !ALLOWED_TYPES.has(file.type) ||
        !file.size || file.size > MAX_BYTES) {
      return Response.json({ error: 'invalid_product_image' }, { status: 400 });
    }
    const form = new FormData();
    form.set('file', file, file.name || 'producto.jpg');
    const upstream = await fetch('https://api.muapi.ai/api/v1/upload_file', {
      method: 'POST',
      headers: { 'x-api-key': env.MUAPI_API_KEY },
      body: form
    });
    if (!upstream.ok) return Response.json({ error: 'product_upload_failed' }, { status: 502 });
    const result = await upstream.json();
    const imageUrl = result.url || result.file_url || result.data?.url;
    if (!isSafePublicImageUrl(imageUrl)) {
      return Response.json({ error: 'invalid_uploaded_image_url' }, { status: 502 });
    }
    return Response.json({ image_url: imageUrl }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
