import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  applyAuthCookies,
  clearAuthCookies,
} from '@/lib/auth-cookies';
import { fetchBackendWithAuthRefresh } from '@/lib/proxy-auth';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const hasAnyAuthCookie =
    Boolean(cookieStore.get(ACCESS_TOKEN_COOKIE)?.value) ||
    Boolean(cookieStore.get(REFRESH_TOKEN_COOKIE)?.value);

  if (!hasAnyAuthCookie) {
    console.warn('[TTS proxy] Synthesis request rejected: missing auth cookies');
    return NextResponse.json(
      { error: 'Người dùng chưa được xác thực' },
      { status: 401 },
    );
  }

  try {
    const bodyText = await request.text();
    const { backendResponse, refreshedTokens, shouldClearCookies } =
      await fetchBackendWithAuthRefresh({
        url: `${BACKEND_URL}/tts/synthesize`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: bodyText,
        signal: request.signal,
      });

    const attachCookies = (res: NextResponse) => {
      if (refreshedTokens) {
        applyAuthCookies(res, refreshedTokens);
      } else if (shouldClearCookies) {
        clearAuthCookies(res);
      }
      return res;
    };

    if (!backendResponse.ok) {
      const errorBody = await backendResponse.text();
      let errorMessage = 'Không thể tổng hợp giọng đọc';
      try {
        const parsed = JSON.parse(errorBody) as {
          message?: string | string[];
          error?: string;
        };
        errorMessage =
          (Array.isArray(parsed.message) ? parsed.message[0] : parsed.message) ||
          parsed.error ||
          errorMessage;
      } catch {
        errorMessage = errorBody || errorMessage;
      }
      console.warn(
        `[TTS proxy] Backend synthesis failed | status=${backendResponse.status} | message=${errorMessage}`,
      );
      return attachCookies(
        NextResponse.json(
          {
            error: errorMessage,
            retryable: backendResponse.status === 429,
          },
          { status: backendResponse.status },
        ),
      );
    }

    const audio = await backendResponse.arrayBuffer();
    console.log(
      `[TTS proxy] Backend synthesis completed | bytes=${audio.byteLength}`,
    );
    return attachCookies(
      new NextResponse(audio, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'private, max-age=300',
          'Content-Length': String(audio.byteLength),
        },
      }),
    );
  } catch (error) {
    if (request.signal.aborted) {
      return new NextResponse(null, { status: 499 });
    }
    console.error('[TTS proxy] Synthesis request failed:', error);
    return NextResponse.json(
      { error: 'Không thể kết nối tới dịch vụ tổng hợp giọng nói' },
      { status: 502 },
    );
  }
}
