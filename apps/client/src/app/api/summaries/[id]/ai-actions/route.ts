import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestPath = `/summaries/${id}/ai-actions`;
  const accessToken = (await cookies()).get('access_token')?.value;

  if (!accessToken) {
    console.warn(`[BlockNote AI proxy] Missing access token: ${requestPath}`);
    return Response.json(
      { error: 'Người dùng chưa được xác thực' },
      { status: 401 },
    );
  }

  try {
    const backendResponse = await fetch(
      `${BACKEND_URL}/summaries/${encodeURIComponent(id)}/ai-actions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': request.headers.get('content-type') ?? 'application/json',
        },
        body: await request.text(),
        cache: 'no-store',
        signal: request.signal,
      },
    );

    if (!backendResponse.ok) {
      const errorBody = await backendResponse.clone().text();
      console.error(
        `[BlockNote AI proxy] Backend returned ${backendResponse.status}: ${requestPath}`,
        errorBody,
      );
    }

    return new Response(backendResponse.body, {
      status: backendResponse.status,
      headers: backendResponse.headers,
    });
  } catch (error) {
    console.error(`[BlockNote AI proxy] Request failed: ${requestPath}`, error);
    return Response.json(
      { error: 'Không thể kết nối tới AI backend' },
      { status: 502 },
    );
  }
}
