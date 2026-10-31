import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { isAdminRole, tierOf, TIER_CONFIG } from '@/lib/tiers';

// GET /api/admin/metrics — global platform rollup (admin only)
//
// Revenue truth rules:
//   mrr          — only companies whose tier state is *billable* (money
//                  actually received; Zelle-approved `active` only today).
//   pipelineMrr  — pending Zelle transfers (unapproved) — reported separately.
//   atRiskMrr    — past-due accounts — reported separately.
//   Demo tenants (isDemo) are excluded from every rollup; they remain listed
//   (badged) so the workspace demo still shows them.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: 'Administrator clearance required.' }, { status: 403 });
  }

  const companies = await db.company.findMany({
    include: {
      _count: { select: { properties: true, users: true, invoices: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const real = companies.filter((c) => !c.isDemo);

  const totalProperties = await db.property.count({
    where: { company: { isDemo: false } },
  });
  const events = await db.activityEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { company: { select: { name: true } } },
  });

  const invoices = await db.invoice.findMany({
    where: { company: { isDemo: false } },
    select: { amount: true, status: true, issuedDate: true },
  });

  const freeCount = real.filter((c) => tierOf(c.subscriptionStatus) === 'free').length;
  const proCount = real.filter((c) => ['active', 'pro_unlocked'].includes(tierOf(c.subscriptionStatus))).length;
  const enterpriseCount = real.filter(
    (c) => tierOf(c.subscriptionStatus) === 'enterprise_unlocked',
  ).length;
  const pendingZelle = real.filter((c) => tierOf(c.subscriptionStatus) === 'pending_zelle_audit').length;
  const pastDueCount = real.filter((c) => tierOf(c.subscriptionStatus) === 'past_due').length;

  const billable = real.filter((c) => TIER_CONFIG[tierOf(c.subscriptionStatus)].billable);
  const mrr = billable.reduce((a, c) => a + TIER_CONFIG[tierOf(c.subscriptionStatus)].monthlyPrice, 0);
  const pipelineMrr = pendingZelle * TIER_CONFIG.pending_zelle_audit.monthlyPrice;
  // At-risk value references the plan price the delinquent account held —
  // `past_due` itself carries monthlyPrice 0 because nothing is being paid.
  // (Single-status limitation: if Enterprise accounts can go past-due, this
  // needs the plan/billingState split.)
  const atRiskMrr = pastDueCount * TIER_CONFIG.active.monthlyPrice;
  const conversionRate =
    real.length > 0 ? Math.round((billable.length / real.length) * 1000) / 10 : 0;

  // Revenue by month (real tenants only, last 6 months)
  const months: Array<{ label: string; revenue: number }> = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), revenue: 0 });
  }
  for (const inv of invoices) {
    const diff =
      (now.getFullYear() - inv.issuedDate.getFullYear()) * 12 +
      (now.getMonth() - inv.issuedDate.getMonth());
    if (diff >= 0 && diff < 6) months[5 - diff].revenue += inv.amount;
  }

  return NextResponse.json({
    totals: {
      companies: real.length,
      demoCompanies: companies.length - real.length,
      freeCount,
      proCount,
      enterpriseCount,
      pendingZelle,
      pastDueCount,
      totalProperties,
      conversionRate,
      mrr,
      pipelineMrr,
      atRiskMrr,
      paidVolume: invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + i.amount, 0),
    },
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      subscriptionStatus: c.subscriptionStatus,
      tierLabel: TIER_CONFIG[tierOf(c.subscriptionStatus)].label,
      billable: TIER_CONFIG[tierOf(c.subscriptionStatus)].billable,
      isDemo: c.isDemo,
      propertyCount: c._count.properties,
      userCount: c._count.users,
      invoiceCount: c._count.invoices,
      createdAt: c.createdAt.toISOString(),
    })),
    alerts: events.map((e) => ({
      id: e.id,
      type: e.type,
      title: e.title,
      message: e.message,
      companyName: e.company?.name ?? 'Platform Core',
      createdAt: e.createdAt.toISOString(),
    })),
    revenueByMonth: months,
    tierDistribution: [
      { name: 'Free', value: freeCount },
      { name: 'Professional', value: proCount },
      { name: 'Enterprise', value: enterpriseCount },
      { name: 'Zelle Pending', value: pendingZelle },
    ],
  });
}
