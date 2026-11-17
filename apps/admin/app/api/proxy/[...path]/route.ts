import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

async function handleAdminProxy(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const resolvedParams = await context.params;
    const pathArray = resolvedParams.path || [];
    const targetPath = pathArray.join('/');

    const cookieStore = await cookies();
    const accessToken = cookieStore.get('admin_access_token')?.value;

    const headers: Record<string, string> = {
      'Content-Type': req.headers.get('Content-Type') || 'application/json',
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const searchParams = req.nextUrl.searchParams.toString();
    const queryString = searchParams ? `?${searchParams}` : '';
    const targetUrl = `${BACKEND_URL}/${targetPath}${queryString}`;

    let bodyText: string | undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const rawBody = await req.text();
      if (rawBody.length > 0) {
        bodyText = rawBody;
      }
    }

    const backendRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: bodyText,
      cache: 'no-store',
    });

    const contentType = backendRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const jsonData = (await backendRes.json().catch(() => null)) as unknown;
      return NextResponse.json(jsonData ?? {}, { status: backendRes.status });
    }

    const textData = await backendRes.text();
    return new NextResponse(textData, {
      status: backendRes.status,
      headers: {
        'Content-Type': contentType || 'text/plain; charset=utf-8',
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Không thể kết nối tới máy chủ Backend.';
    return NextResponse.json(
      { statusCode: 500, message },
      { status: 500 },
    );
  }
}

export const GET = handleAdminProxy;
export const POST = handleAdminProxy;
export const PUT = handleAdminProxy;
export const PATCH = handleAdminProxy;
export const DELETE = handleAdminProxy;
