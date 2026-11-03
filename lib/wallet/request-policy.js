export function walletPilotAction(pathname, enabled, nativeAuth = false) {
  if (!enabled) return 'allow';
  if (nativeAuth && (pathname === '/studio' || pathname === '/studio/' ||
      pathname === '/studio/video' || pathname === '/studio/video/')) return 'allow';
  // Imágenes que venden: permitir exclusivamente el catálogo, análisis y generación propios.
  // Cada POST sigue protegido por misma procedencia, sesión y reserva de saldo en D1.
  if (nativeAuth && /^\/studio\/images\/?$/.test(pathname)) return 'allow';
  if (nativeAuth && /^\/api\/conversion-templates(?:\/|$)/.test(pathname)) return 'allow';
  // Nuevo generador estático: acceso únicamente al namespace propio. Cada
  // escritura comprueba origen, sesión, propiedad de foto y saldo en D1.
  if (nativeAuth && /^\/api\/realizo\/images(?:\/|$)/.test(pathname)) return 'allow';
  // Read-only Sandbox pricing probe; its handler returns 404 in production.
  if (nativeAuth && pathname === '/api/realizo/pricing/health') return 'allow';
  // Token-protected merchant readiness endpoint, inaccessible without a one-time operator secret.
  if (nativeAuth && pathname === '/api/internal/paypal-preflight') return 'allow';
  // Public Luxury Film template prepares only a fixed, server-owned 8-second
  // product-only prompt. Its handler still requires native authentication,
  // same origin and ownership of the signed photo; pricing/payment use the
  // existing /api/wallet routes. Do not expose arbitrary /api/realizo/template/*.
  if (nativeAuth && pathname === '/api/realizo/template/luxury/prepare') return 'allow';
  // Users can manage only their own creative recipes; every endpoint independently
  // verifies the native session and D1 user_id, and mutations require same origin.
  if (nativeAuth && (pathname === '/api/realizo/user-templates' ||
      /^\/api\/realizo\/user-templates\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(pathname))) return 'allow';
  // The export endpoint still verifies session, job ownership and finished status.
  // Allow ONLY /api/realizo/jobs/<UUID>/download, not arbitrary nested job APIs.
  if (nativeAuth && /^\/api\/realizo\/jobs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/download\/?$/i.test(pathname))
    return 'allow';
  if (nativeAuth && (pathname === '/api/realizo/jobs' || pathname === '/api/realizo/media' ||
      pathname.startsWith('/api/realizo/media/') ||
      pathname === '/api/realizo/ai-premium' || pathname.startsWith('/api/realizo/ai-premium/'))) return 'allow';
  if (pathname === '/api/wallet' || pathname.startsWith('/api/wallet/') ||
      pathname === '/api/auth' || pathname.startsWith('/api/auth/')) return 'allow';
  if (pathname === '/api' || pathname.startsWith('/api/')) return 'deny';
  if (pathname === '/wallet' || pathname === '/wallet/' ||
      pathname === '/login' || pathname === '/login/' ||
      pathname === '/create' || pathname === '/create/' ||
      pathname === '/auth/google/callback' ||
      pathname.startsWith('/_next/') ||
      /\.(?:ico|png|jpg|jpeg|webp|svg|woff2?|css|js)$/.test(pathname)) return 'allow';
  return 'redirect';
}

export function contentSecurityPolicy(pathname) {
  const walletPage = pathname === '/wallet' || pathname === '/wallet/';
  const paypal = walletPage ? ' https://*.paypal.com https://*.paypalobjects.com' : '';
  return "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'" + paypal +
    "; style-src 'self' 'unsafe-inline'" + paypal +
    "; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; " +
    "connect-src 'self' https://muapi.ai https://*.muapi.ai" + paypal +
    "; frame-src 'self'" + paypal + "; child-src 'self'" + paypal + "; font-src 'self' data:;";
}
