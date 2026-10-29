export function walletPilotAction(pathname, enabled, nativeAuth = false) {
  if (!enabled) return 'allow';
  if (nativeAuth && (pathname === '/studio' || pathname === '/studio/' ||
      pathname === '/studio/video' || pathname === '/studio/video/')) return 'allow';
  if (nativeAuth && (pathname === '/api/realizo/jobs' || pathname === '/api/realizo/media' ||
      pathname.startsWith('/api/realizo/media/'))) return 'allow';
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
