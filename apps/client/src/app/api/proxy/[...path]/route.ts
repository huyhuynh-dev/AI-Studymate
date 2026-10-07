import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios, { AxiosError } from 'axios';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

/**
 * Proxy Route tổng (API Gateway)
 * Bắt mọi request gửi tới `/api/proxy/...`
 * Tự động đọc access_token từ HttpOnly Cookie và đính kèm vào Header để gọi Backend.
 */
async function handleProxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Đợi params resolve (Bắt buộc từ Next.js 15+)
    const resolvedParams = await params;
    const pathArray = resolvedParams.path || [];
    const targetPath = pathArray.join('/');

    // Đọc access_token từ cookies
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;

    const headers: Record<string, string> = {
      'Content-Type': req.headers.get('Content-Type') || 'application/json',
    };

    // Đính kèm Thẻ nhân viên (Token) nếu có
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Lấy query parameters (ví dụ: ?page=1&limit=10)
    const searchParams = req.nextUrl.searchParams.toString();
    const queryString = searchParams ? `?${searchParams}` : '';

    const url = `${BACKEND_URL}/${targetPath}${queryString}`;

    let data;
    // Đọc body của request nếu không phải GET/HEAD
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        data = await req.json();
      } catch (e) {
        // Body có thể trống hoặc không phải định dạng JSON (bỏ qua lỗi)
      }
    }

    // Chuyển tiếp request tới Backend
    const response = await axios({
      method: req.method,
      url,
      headers,
      data,
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error: any) {
    // Trả về đúng mã lỗi từ backend nếu có
    if (error instanceof AxiosError) {
      return NextResponse.json(
        error.response?.data || { error: error.message },
        { status: error.response?.status || 500 }
      );
    }
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
