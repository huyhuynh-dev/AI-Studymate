import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  applyAuthCookies,
  clearAuthCookies,
} from '@/lib/auth-cookies';
import { verifyCsrfRequest } from '@/lib/csrf-guard';
import { fetchBackendWithAuthRefresh } from '@/lib/proxy-auth';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrfError = verifyCsrfRequest(request);
  if (csrfError) return csrfError;
  const { id } = await params;
  const requestPath = `/summaries/${id}/ai-actions`;
  const cookieStore = await cookies();
  const hasAnyAuthCookie =
    Boolean(cookieStore.get(ACCESS_TOKEN_COOKIE)?.value) ||
    Boolean(cookieStore.get(REFRESH_TOKEN_COOKIE)?.value);

  if (!hasAnyAuthCookie) {
    console.warn(`[BlockNote AI proxy] Missing auth cookies: ${requestPath}`);
    return NextResponse.json(
      { error: 'Người dùng chưa được xác thực' },
      { status: 401 },
    );
  }

  try {
    const bodyText = await request.text();
    const { backendResponse, refreshedTokens, shouldClearCookies } =
      await fetchBackendWithAuthRefresh({
        url: `${BACKEND_URL}/summaries/${encodeURIComponent(id)}/ai-actions`,
        method: 'POST',
        headers: {
          'Content-Type':
            request.headers.get('content-type') ?? 'application/json',
        },
        body: bodyText,
        signal: request.signal,
      });

    if (!backendResponse.ok) {
      const errorBody = await backendResponse.clone().text();
      console.error(
        `[BlockNote AI proxy] Backend returned ${backendResponse.status}: ${requestPath}`,
        errorBody,
      );
    }

    const responseHeaders = new Headers();
    backendResponse.headers.forEach((val, key) => {
      if (key.toLowerCase() !== 'set-cookie') {
        responseHeaders.set(key, val);
      }
    });

    const response = new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      headers: responseHeaders,
    });

    if (refreshedTokens) {
      applyAuthCookies(response, refreshedTokens);
    } else if (shouldClearCookies) {
      clearAuthCookies(response);
    }

    return response;
  } catch (error) {
    console.error(`[BlockNote AI proxy] Request failed: ${requestPath}`, error);
    return NextResponse.json(
      { error: 'Không thể kết nối tới AI backend' },
      { status: 502 },
    );
  }
}
