import { NextResponse } from 'next/server';
import { getLocaleFromPathname } from './lib/locales';
import { contentSecurityPolicy, walletPilotAction } from './lib/wallet/request-policy.js';

function addSecurityHeaders(response, pathname) {
    // Prevent MIME type sniffing (CWE-693)
    response.headers.set('X-Content-Type-Options', 'nosniff');
    // Prevent clickjacking (CWE-1021)
    response.headers.set('X-Frame-Options', 'DENY');
    // Enable XSS filter in legacy browsers
    response.headers.set('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Content Security Policy - restricts script sources to prevent XSS (CWE-79).
    // connect-src covers *.muapi.ai (not just api.muapi.ai) because generated
    // media, model thumbnails, and other assets are served from cdn.muapi.ai
    // and other muapi subdomains that the renderer fetches directly.
    response.headers.set(
        'Content-Security-Policy',
        contentSecurityPolicy(pathname)
    );
    return response;
}

export function proxy(request) {
    const url = request.nextUrl;
    // The Sandbox pilot exposes the wallet only. Legacy BYOK studios and proxies
    // must be migrated before they can use a shared platform credential.
    const pilotAction = walletPilotAction(url.pathname, process.env.REALIZO_WALLET_ONLY === 'true');
    if (pilotAction === 'deny') {
        return addSecurityHeaders(NextResponse.json({ error: 'route_unavailable_in_wallet_pilot' },
            { status: 404 }), url.pathname);
    }
    if (pilotAction === 'redirect') {
        return addSecurityHeaders(NextResponse.redirect(new URL('/wallet', request.url)), url.pathname);
    }

    // Catch requests to /api/workflow, /api/app, and /api/v1
    const isMuApi = url.pathname.startsWith('/api/workflow') ||
                    url.pathname.startsWith('/api/app') ||
                    url.pathname.startsWith('/api/v1');

    if (isMuApi) {
        // Exclude paths that have their own dedicated route handlers with custom logic
        const isHandledByRoute = url.pathname.startsWith('/api/v1/creative-agent') ||
                                url.pathname.startsWith('/api/v1/get_upload_url') ||
                                url.pathname.startsWith('/api/v1/upload-binary');

        if (url.pathname.startsWith('/api/v1') && !isHandledByRoute) {
            const targetUrl = new URL(url.pathname + url.search, 'https://api.muapi.ai');
            const rewriteResponse = NextResponse.rewrite(targetUrl);
            return addSecurityHeaders(rewriteResponse, url.pathname);
        }
    }

    // Plain response header carrying the locale derived from the URL path
    // (same "set in middleware, read via headers() in the root layout"
    // trick the main muapi client uses — see docs/localization.md).
    const response = NextResponse.next();
    response.headers.set('x-locale', getLocaleFromPathname(url.pathname));
    return addSecurityHeaders(response, url.pathname);
}

// Match all paths for security headers. Exclude Next.js internal paths.
export const config = {
    matcher: [
        '/api/:path*',
        '/((?!_next/static|_next/image|favicon.ico|__nextjs_original-stack-frame).*)',
    ],
};
