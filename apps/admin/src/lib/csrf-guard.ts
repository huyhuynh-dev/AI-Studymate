const SAFE_HTTP_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface CsrfCheckOptions {
  checkSafeMethods?: boolean;
}

function normalizeOrigin(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).origin.toLowerCase();
  } catch {
    return null;
  }
}

function buildAllowedOrigins(request: Request): Set<string> {
  const allowed = new Set<string>();

  const reqOrigin = normalizeOrigin(request.url);
  if (reqOrigin) {
    allowed.add(reqOrigin);
  }

  const host = request.headers.get('host')?.trim();
  if (host) {
    const proto =
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
      (reqOrigin?.startsWith('https://') ? 'https' : 'http');
    allowed.add(`${proto}://${host}`.toLowerCase());
    allowed.add(`http://${host}`.toLowerCase());
    allowed.add(`https://${host}`.toLowerCase());
  }

  const forwardedHost = request.headers
    .get('x-forwarded-host')
    ?.split(',')[0]
    ?.trim();
  if (forwardedHost) {
    const proto =
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    allowed.add(`${proto}://${forwardedHost}`.toLowerCase());
  }

  const envOrigins = [
    process.env.ALLOWED_ORIGINS,
    process.env.NEXT_PUBLIC_ADMIN_URL,
  ]
    .filter(Boolean)
    .flatMap((val) => String(val).split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const item of envOrigins) {
    const normalized = normalizeOrigin(item);
    if (normalized) {
      allowed.add(normalized);
    }
  }

  return allowed;
}

export function verifyAdminCsrfRequest(
  request: Request,
  options: CsrfCheckOptions = {},
): Response | null {
  const method = request.method.toUpperCase();
  if (!options.checkSafeMethods && SAFE_HTTP_METHODS.has(method)) {
    return null;
  }

  const secFetchSite = request.headers
    .get('sec-fetch-site')
    ?.trim()
    .toLowerCase();
  if (secFetchSite === 'cross-site') {
    return Response.json(
      { statusCode: 403, message: 'Yêu cầu bị từ chối bởi chính sách bảo vệ CSRF (cross-site).' },
      { status: 403 },
    );
  }

  const allowedOrigins = buildAllowedOrigins(request);
  const originHeader = request.headers.get('origin')?.trim();

  if (originHeader) {
    if (originHeader.toLowerCase() === 'null') {
      return Response.json(
        { statusCode: 403, message: 'Yêu cầu bị từ chối bởi chính sách bảo vệ CSRF (origin null).' },
        { status: 403 },
      );
    }

    const requestOrigin = normalizeOrigin(originHeader);
    if (!requestOrigin || !allowedOrigins.has(requestOrigin)) {
      return Response.json(
        { statusCode: 403, message: 'Yêu cầu bị từ chối bởi chính sách bảo vệ CSRF (Origin không hợp lệ).' },
        { status: 403 },
      );
    }

    return null;
  }

  const refererHeader = request.headers.get('referer')?.trim();
  if (refererHeader) {
    const refererOrigin = normalizeOrigin(refererHeader);
    if (!refererOrigin || !allowedOrigins.has(refererOrigin)) {
      return Response.json(
        { statusCode: 403, message: 'Yêu cầu bị từ chối bởi chính sách bảo vệ CSRF (Referer không hợp lệ).' },
        { status: 403 },
      );
    }
  }

  return null;
}
