import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { isAdminRole, tierOf, TIER_CONFIG } from '@/lib/tiers';

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = isAdminRole(user.role);
  const companyId = user.companyId;

  // Tenant scope: own workspace. Admin scope: real tenants only — demo
  // fixtures are excluded from every aggregate so revenue and conversion
  // reflect paying reality, not seeded showcase data.
  const tenantScope = companyId ? { companyId } : {};
  const companyScope = admin ? { company: { isDemo: false } } : tenantScope;

  const [properties, complianceLogs, invoices, aeoRecords, companies, events] = await Promise.all([
    db.property.findMany({
      where: companyScope,
      select: {
        id: true,
        name: true,
        turfConditionScore: true,
        drainageScore: true,
        satelliteLastAnalyzed: true,
      },
    }),
    db.complianceLog.findMany({
      where: admin ? { property: { company: { isDemo: false } } } : { property: { is: tenantScope } },
      select: { severity: true, resolutionStatus: true },
    }),
    db.invoice.findMany({
      where: companyScope,
      select: { amount: true, status: true, issuedDate: true },
    }),
    db.aeoRecord.findMany({
      where: companyScope,
      select: { searchVisibilityRank: true, keyword: true },
    }),
    admin
      ? db.company.findMany({
          where: { isDemo: false }, // real tenants only — demo fixtures excluded
          select: { subscriptionStatus: true },
        })
      : Promise.resolve([]),
    db.activityEvent.findMany({
      where: admin ? {} : { OR: [{ companyId: companyId ?? 'none' }, { companyId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  // Score aggregates
  const scored = properties.filter((p) => p.turfConditionScore != null);
  const avgTurf = scored.length
    ? Math.round(scored.reduce((a, p) => a + (p.turfConditionScore ?? 0), 0) / scored.length)
    : null;
  const drained = properties.filter((p) => p.drainageScore != null);
  const avgDrainage = drained.length
    ? Math.round(drained.reduce((a, p) => a + (p.drainageScore ?? 0), 0) / drained.length)
    : null;

  const pendingCompliance = complianceLogs.filter((l) => l.resolutionStatus !== 'resolved').length;
  const criticalCompliance = complianceLogs.filter(
    (l) => l.resolutionStatus !== 'resolved' && (l.severity === 'high' || l.severity === 'critical'),
  ).length;

  const paidRevenue = invoices
    .filter((i) => i.status === 'paid')
    .reduce((a, i) => a + i.amount, 0);
  const outstanding = invoices
    .filter((i) => i.status !== 'paid')
    .reduce((a, i) => a + i.amount, 0);

  // Revenue trend — last 6 calendar months
  const months: Array<{ label: string; revenue: number }> = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      revenue: 0,
    });
  }
  const monthIndex = new Map<string, number>();
  months.forEach((m, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
    monthIndex.set(monthKey(d), idx);
  });
  for (const inv of invoices) {
    const idx = monthIndex.get(monthKey(inv.issuedDate));
    if (idx !== undefined) months[idx].revenue += inv.amount;
  }

  // AEO aggregates
  const ranked = aeoRecords.filter((r) => r.searchVisibilityRank != null);
  const aeoAvgRank = ranked.length
    ? Math.round((ranked.reduce((a, r) => a + (r.searchVisibilityRank ?? 0), 0) / ranked.length) * 10) / 10
    : null;

  // Revenue truth — mrr counts only billable states (money received);
  // pending Zelle transfers and past-due accounts are reported separately.
  let mrr: number;
  let pipelineMrr = 0;
  let atRiskMrr = 0;
  let paidCompanies = 0;
  let totalCompanies = 0;
  let conversionRate = 0;
  if (admin) {
    totalCompanies = companies.length;
    paidCompanies = companies.filter((c) => TIER_CONFIG[tierOf(c.subscriptionStatus)].billable).length;
    mrr = companies
      .filter((c) => TIER_CONFIG[tierOf(c.subscriptionStatus)].billable)
      .reduce((a, c) => a + TIER_CONFIG[tierOf(c.subscriptionStatus)].monthlyPrice, 0);
    pipelineMrr = companies.filter((c) => tierOf(c.subscriptionStatus) === 'pending_zelle_audit').length *
      TIER_CONFIG.pending_zelle_audit.monthlyPrice;
    // At-risk value references the plan price the delinquent account held —
    // `past_due` itself carries monthlyPrice 0 (nothing being paid).
    atRiskMrr = companies.filter((c) => tierOf(c.subscriptionStatus) === 'past_due').length *
      TIER_CONFIG.active.monthlyPrice;
    conversionRate = totalCompanies > 0 ? Math.round((paidCompanies / totalCompanies) * 1000) / 10 : 0;
  } else {
    const ownTier = TIER_CONFIG[tierOf(user.company?.subscriptionStatus)];
    mrr = ownTier.billable ? ownTier.monthlyPrice : 0;
  }

  const tierKey = tierOf(user.company?.subscriptionStatus);
  const tier = TIER_CONFIG[tierKey];
  const propertyLimit = admin ? null : tier.propertyLimit;
  const keywordLimit = admin ? null : tier.keywordLimit;

  const distinctKeywords = new Set(aeoRecords.map((r) => r.keyword.toLowerCase())).size;

  return NextResponse.json({
    isAdmin: admin,
    propertyCount: properties.length,
    propertyLimit: propertyLimit === Number.MAX_SAFE_INTEGER ? null : propertyLimit,
    avgTurf,
    avgDrainage,
    pendingCompliance,
    criticalCompliance,
    paidRevenue,
    outstanding,
    mrr,
    pipelineMrr,
    atRiskMrr,
    paidCompanies,
    totalCompanies,
    conversionRate,
    aeoAvgRank,
    aeoTracked: distinctKeywords,
    keywordLimit: keywordLimit === Number.MAX_SAFE_INTEGER ? null : keywordLimit,
    tier: { key: tierKey, label: tier.label, shortLabel: tier.shortLabel, monthlyPrice: tier.monthlyPrice },
    propertyScores: properties.slice(0, 8).map((p) => ({
      name: p.name,
      turf: p.turfConditionScore ?? 0,
      drainage: p.drainageScore ?? 0,
    })),
    revenueTrend: months,
    recentEvents: events.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      message: e.message,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
