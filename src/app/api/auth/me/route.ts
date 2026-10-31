import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { isAdminRole, tierOf, TIER_CONFIG } from '@/lib/tiers';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const companyId = user.companyId;
  const tierKey = tierOf(user.company?.subscriptionStatus);
  const tier = TIER_CONFIG[tierKey];
  const admin = isAdminRole(user.role);

  const [propertyCount, keywordCount] = await Promise.all([
    db.property.count(admin ? {} : { where: { companyId: companyId ?? 'none' } }),
    db.aeoRecord
      .findMany({
        where: admin ? {} : { companyId: companyId ?? 'none' },
        select: { keyword: true },
      })
      .then((rows) => new Set(rows.map((r) => r.keyword.toLowerCase())).size),
  ]);

  const effectivePropertyLimit = admin ? Number.MAX_SAFE_INTEGER : tier.propertyLimit;
  const effectiveKeywordLimit = admin ? Number.MAX_SAFE_INTEGER : tier.keywordLimit;

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      companyId: user.companyId,
      company: user.company,
    },
    isAdmin: admin,
    tier: {
      key: tierKey,
      label: tier.label,
      shortLabel: tier.shortLabel,
      monthlyPrice: tier.monthlyPrice,
    },
    quota: {
      propertyCount,
      propertyLimit: effectivePropertyLimit === Number.MAX_SAFE_INTEGER ? null : effectivePropertyLimit,
      keywordCount,
      keywordLimit: effectiveKeywordLimit === Number.MAX_SAFE_INTEGER ? null : effectiveKeywordLimit,
    },
  });
}
