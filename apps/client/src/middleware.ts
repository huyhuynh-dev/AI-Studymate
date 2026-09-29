import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware
 * Automatically intercepts incoming requests containing OAuth tokens in the query string
 * (e.g. from Google OAuth callback: http://localhost:3000/?token=...&refresh_token=...),
 * stores them into HttpOnly Secure Cookies, and redirects to a clean URL.
 */
export function middleware(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const refreshToken = request.nextUrl.searchParams.get('refresh_token');

  if (token && refreshToken) {
    // Clone URL and remove token and refresh_token from search parameters
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete('token');
    cleanUrl.searchParams.delete('refresh_token');

    // Create redirect response so URL in browser bar is clean
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
