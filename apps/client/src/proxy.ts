import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js 16 Proxy (formerly Middleware)
 * Intercepts incoming requests to extract OAuth tokens (access_token & refresh_token)
 * passed as query parameters (e.g., from Google OAuth callback redirect: /?token=...&refresh_token=...),
 * stores them into HttpOnly Secure Cookies, and redirects to a clean URL.
 */
export function proxy(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const refreshToken = request.nextUrl.searchParams.get('refresh_token');

  if (token && refreshToken) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete('token');
    cleanUrl.searchParams.delete('refresh_token');

    // Redirect to the clean URL (removing tokens from browser address bar & history)
    const response = NextResponse.redirect(cleanUrl);

    const isProduction = process.env.NODE_ENV === 'production';

    // Store tokens into HttpOnly Secure Cookies
    response.cookies.set('access_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 1 day
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  }

  return NextResponse.next();
}

// Also export as default and middleware for complete compatibility across environments
export default proxy;
export { proxy as middleware };

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - static assets (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
