import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  SESSION_COOKIE,
  bearerAuthAllowed,
  createSession,
  hashPassword,
  logActivity,
  sessionCookieOptions,
} from '@/lib/auth';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { PLATFORM_MANAGED_EMAILS, validateCorporateEmail } from '@/lib/tiers';

export async function POST(req: NextRequest) {
  try {
    // Signup abuse guard: 5 workspaces / hour per IP.
    const limit = rateLimit(`register:${clientIp(req)}`, 5, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { code: 'RATE_LIMITED', error: `Registration quota reached. Retry in ${limit.retryAfterSec}s.` },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => null);
    const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : null;

    if (!companyName || companyName.length < 2) {
      return NextResponse.json({ error: 'Company / organization name is required.' }, { status: 400 });
    }
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and security key phrase are required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Security key phrase must be at least 8 characters.' },
        { status: 400 },
      );
    }

    // Platform-managed identities (admin accounts) are provisioned by the
    // seed / ops process only — self-service signup can never squat them,
    // and elevated roles never come from a signup email match.
    if (PLATFORM_MANAGED_EMAILS.includes(email)) {
      return NextResponse.json(
        { error: 'This profile is platform-managed and cannot be self-registered.' },
        { status: 403 },
      );
    }

    // Corporate domain policy (B2B lead qualification)
    const domainCheck = validateCorporateEmail(email);
    if (!domainCheck.isValid) {
      return NextResponse.json({ code: 'CONSUMER_DOMAIN_BLOCKED', error: domainCheck.reason }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'A profile already exists for this email.' }, { status: 409 });
    }

    const company = await db.company.create({
      data: { name: companyName, subscriptionStatus: 'free' },
    });
    const user = await db.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        fullName: fullName || companyName,
        role: 'operator',
        companyId: company.id,
      },
    });

    await logActivity(
      company.id,
      'system',
      'New tenant onboarded',
      `${companyName} registered on the Free Discovery tier (5 property audit tokens).`,
    );

    const { token } = await createSession(user.id);
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
        company: { id: company.id, name: company.name, subscriptionStatus: company.subscriptionStatus },
      },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err) {
    console.error('[register] failure:', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Registration pipeline failed.' }, { status: 500 });
  }
}
