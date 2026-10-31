import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, logActivity } from '@/lib/auth';
import {
  AUTO_PROMOTION_THRESHOLD,
  TIER_CONFIG,
  isAdminRole,
  tierOf,
} from '@/lib/tiers';

// GET /api/properties — tenant-scoped list
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = isAdminRole(user.role);
  const where = admin ? {} : { companyId: user.companyId ?? 'none' };

  const properties = await db.property.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { complianceLogs: { where: { resolutionStatus: { not: 'resolved' } } } } },
      company: { select: { id: true, name: true, subscriptionStatus: true } },
    },
  });

  return NextResponse.json({
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      latitude: p.latitude,
      longitude: p.longitude,
      turfConditionScore: p.turfConditionScore,
      drainageScore: p.drainageScore,
      satelliteImageUrl: p.satelliteImageUrl,
      satelliteLastAnalyzed: p.satelliteLastAnalyzed?.toISOString() ?? null,
      openComplianceCount: p._count.complianceLogs,
      companyName: p.company.name,
      companyStatus: p.company.subscriptionStatus,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

// POST /api/properties — create with quota enforcement + auto tier promotion
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const address = typeof body?.address === 'string' ? body.address.trim() : '';
  const latitude = typeof body?.latitude === 'number' ? body.latitude : null;
  const longitude = typeof body?.longitude === 'number' ? body.longitude : null;

  if (!name) return NextResponse.json({ error: 'Property name is required.' }, { status: 400 });

  const companyId = user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: 'No tenant workspace bound to this profile.' }, { status: 400 });
  }

  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });

  const admin = isAdminRole(user.role);
  const tierKey = tierOf(company.subscriptionStatus);
  const tier = TIER_CONFIG[tierKey];
  const currentCount = await db.property.count({ where: { companyId } });

  // Quota ceiling — master admins bypass entirely (blueprint: check_property_quota)
  if (!admin && currentCount >= tier.propertyLimit) {
    return NextResponse.json(
      {
        code: 'QUOTA_EXCEEDED',
        error: `Property quota exceeded for ${tier.label} tier (${tier.propertyLimit}). Upgrade to Professional for 50 monthly audits.`,
        tier: tierKey,
        limit: tier.propertyLimit === Number.MAX_SAFE_INTEGER ? null : tier.propertyLimit,
      },
      { status: 403 },
    );
  }

  const property = await db.property.create({
    data: { companyId, name, address: address || null, latitude, longitude },
  });

  // Auto tier-shift trigger (blueprint: automate_user_tier_status)
  let autoPromoted = false;
  const newCount = currentCount + 1;
  if (tierKey === 'free' && newCount >= AUTO_PROMOTION_THRESHOLD) {
    await db.company.update({
      where: { id: companyId },
      data: { subscriptionStatus: 'pro_unlocked' },
    });
    autoPromoted = true;
    await logActivity(
      companyId,
      'tier_upgrade',
      '🚀 SaaS Conversion Alert!',
      `${company.name} automatically upgraded to the PRO tier based on heavy active usage indices (${newCount} monitored properties).`,
    );
  } else {
    await logActivity(
      companyId,
      'system',
      'Property added to ledger',
      `${name} registered under ${company.name}${address ? ` (${address})` : ''}.`,
    );
  }

  return NextResponse.json({
    property: {
      id: property.id,
      name: property.name,
      address: property.address,
      latitude: property.latitude,
      longitude: property.longitude,
      turfConditionScore: property.turfConditionScore,
      drainageScore: property.drainageScore,
      satelliteImageUrl: property.satelliteImageUrl,
      satelliteLastAnalyzed: property.satelliteLastAnalyzed?.toISOString() ?? null,
      openComplianceCount: 0,
      companyName: company.name,
      companyStatus: autoPromoted ? 'pro_unlocked' : company.subscriptionStatus,
      createdAt: property.createdAt.toISOString(),
    },
    autoPromoted,
  });
}
