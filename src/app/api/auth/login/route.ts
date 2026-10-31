import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  SESSION_COOKIE,
  bearerAuthAllowed,
  createSession,
  logActivity,
  sessionCookieOptions,
  verifyPassword,
} from '@/lib/auth';
import { clientIp, rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and security key phrase are required.' }, { status: 400 });
    }

    // Brute-force guard: 8 attempts / 15 min per (ip, email) pair.
    const limit = rateLimit(`login:${clientIp(req)}:${email}`, 8, 15 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { code: 'RATE_LIMITED', error: `Too many attempts. Retry in ${limit.retryAfterSec}s.` },
        { status: 429 },
      );
    }

    const user = await db.user.findUnique({
      where: { email },
      include: { company: true },
    });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: 'Invalid gateway credentials.' }, { status: 401 });
    }

    const { token } = await createSession(user.id);
    await logActivity(
      user.companyId,
      'system',
      'Gateway authentication',
      `${user.email} authenticated into the RHS control center.`,
    );

    const res = NextResponse.json({
      // Bearer fallback for cookie-blocked (cross-site iframe) clients —
      // only issued when the bearer flag is enabled.
      ...(bearerAuthAllowed() ? { token } : {}),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        companyId: user.companyId,
        company: user.company
          ? {
              id: user.company.id,
              name: user.company.name,
              subscriptionStatus: user.company.subscriptionStatus,
            }
          : null,
      },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error('[login] failure:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Authentication gateway unreachable.' }, { status: 500 });
  }
}
