import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, logActivity } from '@/lib/auth';
import { isAdminRole } from '@/lib/tiers';

// GET /api/admin/zelle — manual transfer audit queue (admin only)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: 'Administrator clearance required.' }, { status: 403 });
  }

  const pending = await db.company.findMany({
    where: { subscriptionStatus: 'pending_zelle_audit' },
    include: { _count: { select: { properties: true, users: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({
    queue: pending.map((c) => ({
      id: c.id,
      name: c.name,
      reference: c.stripeCustomerId ?? `zelle_ref_${c.id.slice(0, 8)}`,
      propertyCount: c._count.properties,
      userCount: c._count.users,
      requestedAt: c.updatedAt.toISOString(),
    })),
  });
}

// POST /api/admin/zelle — approve or reject a pending transfer
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: 'Administrator clearance required.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const companyId = typeof body?.companyId === 'string' ? body.companyId : '';
  const action = body?.action === 'reject' ? 'reject' : 'approve';

  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: 'Company not found.' }, { status: 404 });
  if (company.subscriptionStatus !== 'pending_zelle_audit') {
    return NextResponse.json({ error: 'This account is not in the Zelle audit queue.' }, { status: 400 });
  }

  if (action === 'approve') {
    await db.company.update({ where: { id: companyId }, data: { subscriptionStatus: 'active' } });
    await logActivity(
      companyId,
      'zelle',
      'Zelle transfer approved',
      `${company.name} — manual bank verification cleared by ${user.email}. Professional tier provisioned.`,
    );
    return NextResponse.json({ ok: true, status: 'active' });
  }

  await db.company.update({ where: { id: companyId }, data: { subscriptionStatus: 'free' } });
  await logActivity(
    companyId,
    'zelle',
    'Zelle transfer rejected',
    `${company.name} — administrator could not verify the referenced transfer. Account returned to Free tier.`,
  );
  return NextResponse.json({ ok: true, status: 'free' });
}
