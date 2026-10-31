import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// CSRF defense for cookie-authenticated state-changing API calls.
//
// Cross-site POST/PATCH/PUT/DELETE requests from browsers always carry an
// Origin header; if it doesn't match the request host, the call is forged.
// Bearer-token requests authenticate via header (not ambient cookie
// credentials), so CSRF does not apply and they pass without the check.
// Non-browser clients (no Origin at all) cannot rely on ambient cookies
// either, so they are allowed through — auth still applies at the route.
// ---------------------------------------------------------------------------
const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export default function proxy(req: NextRequest) {
  if (!MUTATING.has(req.method)) return NextResponse.next();

  if (req.headers.get('authorization')?.startsWith('Bearer ')) {
    return NextResponse.next();
  }

  const origin = req.headers.get('origin');
  if (!origin) return NextResponse.next();

  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    return NextResponse.json({ error: 'Malformed origin header.' }, { status: 403 });
  }

  const host = req.headers.get('host') ?? req.nextUrl.host;
  if (originHost !== host) {
    return NextResponse.json({ error: 'Cross-origin request rejected.' }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
