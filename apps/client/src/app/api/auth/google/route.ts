import { NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:3001';

export async function GET() {
  try {
    // Backend endpoint returns 302 redirect or string url
    const response = await fetch(`${BACKEND_URL}/auth/google-auth`, {
      method: 'GET',
      redirect: 'manual', // Do not automatically follow redirect so we can extract Location header
    });

    const locationHeader = response.headers.get('location');

    if (locationHeader) {
      return NextResponse.json({ url: locationHeader });
    }

    // If backend returned url in body
    const bodyText = await response.text();
    try {
      const parsed = JSON.parse(bodyText);
      if (parsed.url) {
        return NextResponse.json({ url: parsed.url });
      }
    } catch {
      // not JSON
    }

    if (bodyText && bodyText.startsWith('http')) {
      return NextResponse.json({ url: bodyText });
    }

    // Default fallback to direct endpoint
    return NextResponse.json({ url: `${BACKEND_URL}/auth/google-auth` });
  } catch (error: any) {
    console.error('Error fetching Google auth URL:', error.message);
    return NextResponse.json(
      { url: `${BACKEND_URL}/auth/google-auth` },
      { status: 200 }
    );
  }
}
