import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'crypto';
import { promisify } from 'util';
import { cookies, headers } from 'next/headers';
import { db } from '@/lib/db';

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export const SESSION_COOKIE = 'rhs_session';
export const BEARER_SCHEME = 'Bearer ';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

// ---------------------------------------------------------------------------
// Embedded-preview / bearer auth gates.
//
// The sandbox preview renders the app inside a cross-site iframe, so it needs
// SameSite=None cookies and the Bearer fallback. Production (first-party
// hosting on rhsaisolutions.com) must leave both unset: the cookie stays
// `lax` (CSRF-protected) and localStorage tokens are never issued.
// ---------------------------------------------------------------------------
export function embeddedSessionsAllowed(): boolean {
  return process.env.ALLOW_EMBEDDED_SESSIONS === 'true';
}

export function bearerAuthAllowed(): boolean {
  return process.env.ALLOW_BEARER_AUTH === 'true';
}

// ---------------------------------------------------------------------------
// Password hashing (scrypt, async — never block the event loop)
// ---------------------------------------------------------------------------
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, 64)).toString('hex');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [salt, hash] = stored.split(':');
    const candidate = await scrypt(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sessions — tokens are stored as sha256 digests; the raw token only ever
// lives in the httpOnly cookie / the client bearer store.
// ---------------------------------------------------------------------------
const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

export interface CompanyRow {
  id: string;
  name: string;
  subscriptionStatus: string;
}

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  companyId: string | null;
  company: CompanyRow | null;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  // Opportunistic cleanup — keeps expired rows from accumulating.
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => undefined);
  await db.session.create({ data: { token: hashToken(token), userId, expiresAt } });
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await db.session.deleteMany({ where: { token: hashToken(token) } });
}

async function lookupSession(rawToken: string | null): Promise<{
  user: SessionUser | null;
  expired: boolean;
}> {
  if (!rawToken) return { user: null, expired: false };
  const session = await db.session.findUnique({
    where: { token: hashToken(rawToken) },
    include: { user: { include: { company: true } } },
  });
  if (!session) return { user: null, expired: false };
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return { user: null, expired: true };
  }
  const u = session.user;
  return {
    user: {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      companyId: u.companyId,
      company: u.company
        ? { id: u.company.id, name: u.company.name, subscriptionStatus: u.company.subscriptionStatus }
        : null,
    },
    expired: false,
  };
}

/**
 * Raw active-session token (cookie first, bearer fallback) — used by logout
 * to destroy whichever session is actually in flight.
 */
export async function readActiveSessionToken(): Promise<string | null> {
  const cookieToken = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  if (cookieToken) return cookieToken;
  if (bearerAuthAllowed()) {
    const authorization = (await headers()).get('authorization');
    if (authorization?.startsWith(BEARER_SCHEME)) {
      const bearer = authorization.slice(BEARER_SCHEME.length).trim();
      if (bearer) return bearer;
    }
  }
  return null;
}

/**
 * Resolve the active session user.
 *
 * Cookie first; if the cookie session is missing or expired, fall through to
 * the Bearer token (when enabled). Bearer-authenticated calls skip the CSRF
 * surface entirely, so the ordering never weakens either transport.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieToken = (await cookies()).get(SESSION_COOKIE)?.value ?? null;
  const primary = await lookupSession(cookieToken);
  if (primary.user) return primary.user;

  if (bearerAuthAllowed()) {
    const authorization = (await headers()).get('authorization');
    if (authorization?.startsWith(BEARER_SCHEME)) {
      const bearer = authorization.slice(BEARER_SCHEME.length).trim();
      const fallback = await lookupSession(bearer || null);
      if (fallback.user) return fallback.user;
    }
  }
  return null;
}

export function sessionCookieOptions() {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  if (embeddedSessionsAllowed()) {
    // Cross-site preview iframe: partitioned CHIPS cookie (secure required).
    return {
      httpOnly: true,
      sameSite: 'none' as const,
      partitioned: true,
      secure: true,
      path: '/',
      maxAge,
    };
  }
  // Production default: strict first-party session cookie.
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

// ---------------------------------------------------------------------------
// Activity events (n8n alert replacement)
// ---------------------------------------------------------------------------
export async function logActivity(
  companyId: string | null,
  type: string,
  title: string,
  message: string,
): Promise<void> {
  await db.activityEvent
    .create({ data: { companyId, type, title, message } })
    .catch((err) => console.error('[logActivity] write failed:', err?.message ?? err));
}
