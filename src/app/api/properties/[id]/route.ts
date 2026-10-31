import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, logActivity } from '@/lib/auth';
import { isAdminRole, tierOf, AUTO_PROMOTION_THRESHOLD } from '@/lib/tiers';

// DELETE /api/properties/[id] — with auto tier downgrade (blueprint trigger)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const property = await db.property.findUnique({ where: { id }, include: { company: true } });
  if (!property) return NextResponse.json({ error: 'Property not found.' }, { status: 404 });

  const admin = isAdminRole(user.role);
  if (!admin && property.companyId !== user.companyId) {
    return NextResponse.json({ error: 'Forbidden — tenant boundary violation.' }, { status: 403 });
  }

  await db.property.delete({ where: { id } });

  // Auto tier shift on delete: auto-unlocked companies fall back under threshold
  const companyId = property.companyId;
  const company = property.company;
  if (company.subscriptionStatus === 'pro_unlocked') {
    const remaining = await db.property.count({ where: { companyId } });
    if (remaining < AUTO_PROMOTION_THRESHOLD) {
      await db.company.update({ where: { id: companyId }, data: { subscriptionStatus: 'free' } });
      await logActivity(
        companyId,
        'system',
        'Tier recalculated',
        `${company.name} dropped below ${AUTO_PROMOTION_THRESHOLD} monitored properties — auto-unlocked Professional access reverted to Free.`,
      );
    }
  }

  return NextResponse.json({ ok: true });
}
