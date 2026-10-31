import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  SESSION_COOKIE,
  bearerAuthAllowed,
  createSession,
  logActivity,
  sessionCookieOptions,
} from '@/lib/auth';
import { clientIp, rateLimit } from '@/lib/rate-limit';

// POST /api/auth/demo — one-click demo workspace access.
//
// Credentials never ship in the client bundle: the demo identity is resolved
// server-side from DEMO_USER_EMAIL and is only honored when it belongs to a
// demo-flagged (non-admin) tenant, so this endpoint can never mint an admin
// session. Rate-limited so bots cannot farm the session table.
export async function POST(req: NextRequest) {
  try {
    const limit = rateLimit(`demo:${clientIp(req)}`, 10, 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { code: 'RATE_LIMITED', error: `Demo gateway is busy. Retry in ${limit.retryAfterSec}s.` },
        { status: 429 },
      );
    }

    const demoEmail = process.env.DEMO_USER_EMAIL?.trim().toLowerCase();
    if (!demoEmail) {
      return NextResponse.json(
        { error: 'Demo access is not configured on this deployment.' },
        { status: 503 },
      );
    }

    const user = await db.user.findUnique({
      where: { email: demoEmail },
      include: { company: true },
    });
    const company = user?.company;
    if (!user || user.role === 'admin' || !company?.isDemo) {
      return NextResponse.json({ error: 'Demo workspace unavailable.' }, { status: 404 });
    }

    const { token } = await createSession(user.id);
    await logActivity(
      user.companyId,
      'system',
      'Demo gateway session',
      `A visitor entered the ${company.name} demo workspace.`,
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
        company: {
          id: company.id,
          name: company.name,
          subscriptionStatus: company.subscriptionStatus,
        },
      },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error('[demo] failure:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Demo gateway unreachable.' }, { status: 500 });
  }
}
