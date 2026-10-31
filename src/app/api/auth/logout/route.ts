import { NextResponse } from 'next/server';
import { SESSION_COOKIE, destroySession, readActiveSessionToken, sessionCookieOptions } from '@/lib/auth';

export async function POST() {
  // Covers both the httpOnly cookie and the Bearer-token fallback, so a
  // logout always terminates the real active session.
  const token = await readActiveSessionToken();
  if (token) {
    await destroySession(token).catch((err) => console.error('[logout] destroy failed:', err?.message ?? err));
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
