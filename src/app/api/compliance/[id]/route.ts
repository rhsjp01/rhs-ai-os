import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, logActivity } from '@/lib/auth';
import { READ_ONLY_TIERS, isAdminRole, tierOf } from '@/lib/tiers';

const ALLOWED_STATUSES = ['pending', 'scheduled', 'resolved'];

// PATCH /api/compliance/[id] — resolution status transitions
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const resolutionStatus = typeof body?.resolutionStatus === 'string' ? body.resolutionStatus : '';

  if (!ALLOWED_STATUSES.includes(resolutionStatus)) {
    return NextResponse.json({ error: 'Invalid resolution status.' }, { status: 400 });
  }

  const log = await db.complianceLog.findUnique({
    where: { id },
    include: { property: { include: { company: true } } },
  });
  if (!log) return NextResponse.json({ error: 'Compliance log not found.' }, { status: 404 });

  const admin = isAdminRole(user.role);
  if (!admin && log.property.companyId !== user.companyId) {
    return NextResponse.json({ error: 'Forbidden — tenant boundary violation.' }, { status: 403 });
  }

  if (!admin && READ_ONLY_TIERS.includes(tierOf(log.property.company.subscriptionStatus))) {
    return NextResponse.json(
      {
        code: 'COMPLIANCE_READ_ONLY',
        error: 'Compliance logging is view-only on the Free tier. Upgrade to Professional for full read/write.',
      },
      { status: 403 },
    );
  }

  const updated = await db.complianceLog.update({ where: { id }, data: { resolutionStatus } });

  if (resolutionStatus === 'resolved') {
    await logActivity(
      log.property.companyId,
      'compliance',
      'Compliance issue resolved',
      `${log.logType} on ${log.property.name} marked resolved.`,
    );
  }

  return NextResponse.json({ ok: true, resolutionStatus: updated.resolutionStatus });
}
