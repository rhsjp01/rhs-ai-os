import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, logActivity } from '@/lib/auth';
import { READ_ONLY_TIERS, isAdminRole, tierOf } from '@/lib/tiers';

// GET /api/compliance — ledger feed (tenant-scoped)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = isAdminRole(user.role);
  const where = admin
    ? {}
    : { property: { is: { companyId: user.companyId ?? 'none' } } };

  const logs = await db.complianceLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: {
      property: {
        select: {
          id: true,
          name: true,
          companyId: true,
          company: { select: { name: true } },
        },
      },
      loggedBy: { select: { fullName: true, email: true } },
    },
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      propertyId: l.propertyId,
      propertyName: l.property.name,
      companyName: l.property.company.name,
      logType: l.logType,
      severity: l.severity,
      description: l.description,
      resolutionStatus: l.resolutionStatus,
      dueDate: l.dueDate?.toISOString() ?? null,
      loggedByName: l.loggedBy?.fullName ?? l.loggedBy?.email ?? 'System',
      createdAt: l.createdAt.toISOString(),
    })),
  });
}

// POST /api/compliance — log a new issue (Free tier is view-only per pricing matrix)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const propertyId = typeof body?.propertyId === 'string' ? body.propertyId : '';
  const logType = typeof body?.logType === 'string' ? body.logType.trim() : '';
  const severity = typeof body?.severity === 'string' ? body.severity : 'low';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const dueDate = typeof body?.dueDate === 'string' && body.dueDate ? new Date(body.dueDate) : null;

  if (!propertyId || !logType) {
    return NextResponse.json({ error: 'Property and log type are required.' }, { status: 400 });
  }

  const property = await db.property.findUnique({ where: { id: propertyId }, include: { company: true } });
  if (!property) return NextResponse.json({ error: 'Property not found.' }, { status: 404 });

  const admin = isAdminRole(user.role);
  if (!admin && property.companyId !== user.companyId) {
    return NextResponse.json({ error: 'Forbidden — tenant boundary violation.' }, { status: 403 });
  }

  // Free / past_due / pending tiers have view-only ledger access
  if (!admin && READ_ONLY_TIERS.includes(tierOf(property.company.subscriptionStatus))) {
    return NextResponse.json(
      {
        code: 'COMPLIANCE_READ_ONLY',
        error: 'Compliance logging is view-only on the Free tier. Upgrade to Professional for full read/write and PDF export.',
      },
      { status: 403 },
    );
  }

  const log = await db.complianceLog.create({
    data: {
      propertyId,
      loggedById: user.id,
      logType,
      severity,
      description: description || null,
      resolutionStatus: 'pending',
      dueDate,
    },
  });

  await logActivity(
    property.companyId,
    'compliance',
    'Compliance issue logged',
    `${logType} (${severity} severity) filed against ${property.name}.`,
  );

  return NextResponse.json({
    log: {
      id: log.id,
      propertyId: log.propertyId,
      propertyName: property.name,
      companyName: property.company.name,
      logType: log.logType,
      severity: log.severity,
      description: log.description,
      resolutionStatus: log.resolutionStatus,
      dueDate: log.dueDate?.toISOString() ?? null,
      loggedByName: user.fullName ?? user.email,
      createdAt: log.createdAt.toISOString(),
    },
  });
}
