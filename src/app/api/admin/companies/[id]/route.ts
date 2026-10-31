import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, logActivity } from '@/lib/auth';
import { isAdminRole, tierOf, TIER_CONFIG } from '@/lib/tiers';

// PATCH /api/admin/companies/[id] — administrative tier status override
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: 'Administrator clearance required.' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = typeof body?.subscriptionStatus === 'string' ? body.subscriptionStatus : '';

  if (!(status in TIER_CONFIG)) {
    return NextResponse.json({ error: 'Invalid subscription status.' }, { status: 400 });
  }

  const company = await db.company.findUnique({ where: { id } });
  if (!company) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });

  const previous = company.subscriptionStatus;
  const updated = await db.company.update({ where: { id }, data: { subscriptionStatus: status } });

  await logActivity(
    id,
    'tier_upgrade',
    'Administrative tier override',
    `${company.name} status switched from ${tierOf(previous)} → ${status} by ${user.email}.`,
  );

  return NextResponse.json({ ok: true, subscriptionStatus: updated.subscriptionStatus });
}
