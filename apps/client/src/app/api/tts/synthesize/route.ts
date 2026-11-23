import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

export async function POST(request: NextRequest) {
  const accessToken = (await cookies()).get('access_token')?.value;
  if (!accessToken) {
    console.warn('[TTS proxy] Synthesis request rejected: missing access token');
    return Response.json(
      { error: 'Người dùng chưa được xác thực' },
      { status: 401 },
    );
  }

  try {
    const backendResponse = await fetch(`${BACKEND_URL}/tts/synthesize`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: await request.text(),
      cache: 'no-store',
      signal: request.signal,
    });

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
      return Response.json(
        {
          error: errorMessage,
          retryable: backendResponse.status === 429,
        },
        { status: backendResponse.status },
      );
    }

    const audio = await backendResponse.arrayBuffer();
    console.log(
      `[TTS proxy] Backend synthesis completed | bytes=${audio.byteLength}`,
    );
    return new Response(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, max-age=300',
        'Content-Length': String(audio.byteLength),
      },
    });
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    console.error('[TTS proxy] Synthesis request failed:', error);
    return Response.json(
      { error: 'Không thể kết nối tới dịch vụ tổng hợp giọng nói' },
      { status: 502 },
    );
  }
}
