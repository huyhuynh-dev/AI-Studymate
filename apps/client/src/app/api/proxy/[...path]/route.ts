import { NextRequest, NextResponse } from 'next/server';
import { applyAuthCookies, clearAuthCookies } from '@/lib/auth-cookies';
import { verifyCsrfRequest } from '@/lib/csrf-guard';
import { fetchBackendWithAuthRefresh } from '@/lib/proxy-auth';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

/**
 * Proxy Route tổng (API Gateway)
 * Bắt mọi request gửi tới `/api/proxy/...`
 * Tự động đọc access_token từ HttpOnly Cookie, làm mới token nếu hết hạn
 * và đính kèm vào Header để gọi Backend.
 */
async function handleProxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const csrfError = verifyCsrfRequest(req);
  if (csrfError) return csrfError;

  try {
    const resolvedParams = await params;
    const pathArray = resolvedParams.path || [];
    const targetPath = pathArray.join('/');

    const headers: Record<string, string> = {
      'Content-Type': req.headers.get('Content-Type') || 'application/json',
    };

    const searchParams = req.nextUrl.searchParams.toString();
    const queryString = searchParams ? `?${searchParams}` : '';
    const url = `${BACKEND_URL}/${targetPath}${queryString}`;

    let bodyBuffer: ArrayBuffer | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        const buf = await req.arrayBuffer();
        if (buf.byteLength > 0) {
          bodyBuffer = buf;
        }
      } catch {
        // Body có thể trống
      }
    }

    const { backendResponse, refreshedTokens, shouldClearCookies } =
      await fetchBackendWithAuthRefresh({
        url,
        method: req.method,
        headers,
        body: bodyBuffer,
        signal: req.signal,
      });

    const attachCookies = (res: NextResponse) => {
      if (refreshedTokens) {
        applyAuthCookies(res, refreshedTokens);
      } else if (shouldClearCookies) {
        clearAuthCookies(res);
      }
      return res;
    };

    // Nếu là endpoint chat stream, chuyển tiếp trực tiếp stream real-time về Client
    if (targetPath.endsWith('/chat')) {
      const responseHeaders = new Headers();
      backendResponse.headers.forEach((val, key) => {
        if (key.toLowerCase() !== 'set-cookie') {
          responseHeaders.set(key, val);
        }
      });

      const streamRes = new NextResponse(backendResponse.body, {
        status: backendResponse.status,
        headers: responseHeaders,
      });
      return attachCookies(streamRes);
    }

    if (backendResponse.status === 204 || backendResponse.status === 304) {
      return attachCookies(
        new NextResponse(null, { status: backendResponse.status })
      );
    }

    const contentType = backendResponse.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const jsonData = await backendResponse.json().catch(() => null);
      return attachCookies(
        NextResponse.json(jsonData ?? {}, { status: backendResponse.status })
      );
    }

    const responseBytes = await backendResponse.arrayBuffer();
    return attachCookies(
      new NextResponse(responseBytes, {
        status: backendResponse.status,
        headers: {
          'Content-Type': contentType || 'application/octet-stream',
        },
      })
    );
  } catch (error: unknown) {
    if (req.signal.aborted) {
      return new NextResponse(null, { status: 499 });
    }
    console.error('[Proxy Error]:', error);
    return NextResponse.json(
      { error: 'Lỗi máy chủ proxy nội bộ (Internal Server Error)' },
      { status: 500 }
    );
  }
}

// Bắt tất cả các phương thức HTTP
export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
