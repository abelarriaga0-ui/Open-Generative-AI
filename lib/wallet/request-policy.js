export function walletPilotAction(pathname, enabled) {
  if (!enabled) return 'allow';
  if (pathname === '/api/wallet' || pathname.startsWith('/api/wallet/')) return 'allow';
  if (pathname === '/api' || pathname.startsWith('/api/')) return 'deny';
  if (pathname === '/wallet' || pathname === '/wallet/' ||
      pathname === '/login' || pathname === '/login/' ||
      pathname === '/auth/callback' || pathname.startsWith('/api/auth/') ||
      pathname.startsWith('/_next/') ||
      /\.(?:ico|png|jpg|jpeg|webp|svg|woff2?|css|js)$/.test(pathname)) return 'allow';
  return 'redirect';
}

export function contentSecurityPolicy(pathname) {
  const walletPage = pathname === '/wallet' || pathname === '/wallet/';
  const paypal = walletPage ? ' https://*.paypal.com https://*.paypalobjects.com' : '';
  const login = pathname === '/login' || pathname === '/login/' ?
    ' https://*.supabase.co' : '';
  return "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'" + paypal +
    "; style-src 'self' 'unsafe-inline'" + paypal +
    "; img-src 'self' data: blob: https:; media-src 'self' data: blob: https:; " +
    "connect-src 'self' https://muapi.ai https://*.muapi.ai" + paypal + login +
    "; frame-src 'self'" + paypal + "; child-src 'self'" + paypal + "; font-src 'self' data:;";
}
