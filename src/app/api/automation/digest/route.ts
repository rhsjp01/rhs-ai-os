import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { isAdminRole, tierOf, TIER_CONFIG } from '@/lib/tiers';

function money(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

// GET /api/automation/digest — compiles the 8:00 AM daily metrics digest
// (replaces the n8n scheduled workflow + HTML email payload)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!isAdminRole(user.role)) {
    return NextResponse.json({ error: 'Administrator clearance required.' }, { status: 403 });
  }

  const companies = await db.company.findMany({
    where: { isDemo: false }, // real tenants only
    include: { _count: { select: { properties: true } } },
  });

  const totalProperties = await db.property.count({
    where: { company: { isDemo: false } },
  });
  const freeTierCount = companies.filter((c) => tierOf(c.subscriptionStatus) === 'free').length;
  const proTierCount = companies.filter((c) =>
    ['active', 'pro_unlocked', 'enterprise_unlocked'].includes(tierOf(c.subscriptionStatus)),
  ).length;
  const pendingZelle = companies.filter((c) => tierOf(c.subscriptionStatus) === 'pending_zelle_audit').length;
  const conversionRate =
    companies.length > 0
      ? ((companies.filter((c) => TIER_CONFIG[tierOf(c.subscriptionStatus)].billable).length /
          companies.length) *
          100).toFixed(1)
      : '0.0';
  // Revenue truth: only billable states count. Pending Zelle transfers are
  // reported as pipeline, never as projected revenue.
  const billableCompanies = companies.filter((c) => TIER_CONFIG[tierOf(c.subscriptionStatus)].billable);
  const estimatedMrr = billableCompanies.reduce(
    (a, c) => a + TIER_CONFIG[tierOf(c.subscriptionStatus)].monthlyPrice,
    0,
  );
  const pipelineMrr = pendingZelle * TIER_CONFIG.pending_zelle_audit.monthlyPrice;

  const reportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const metrics = {
    reportDate,
    totalProperties,
    freeTierCount,
    proTierCount,
    pendingZelle,
    conversionRate: `${conversionRate}%`,
    estimatedMrr: money(estimatedMrr),
    pipelineMrr: money(pipelineMrr),
    totalTenants: companies.length,
  };

  // HTML email payload (adapted from the blueprint digest template)
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>RHS AI Solutions OS Daily Digest</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #ededed;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0a0a0a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #121212; border: 1px solid #262626; border-radius: 16px; overflow: hidden; padding: 32px;">
          <tr>
            <td style="border-bottom: 1px solid #262626; padding-bottom: 20px;">
              <span style="font-size: 12px; font-family: monospace; color: #10b981; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">&bull; System Automation Core</span>
              <h1 style="font-size: 24px; font-weight: 800; color: #ffffff; margin: 6px 0 0 0; letter-spacing: -0.5px;">RHS AI Solutions OS Digest</h1>
              <p style="font-size: 14px; color: #a3a3a3; margin: 4px 0 0 0;">Platform Metrics &amp; Structural Tier Rollup</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 0 12px 0;">
              <table border="0" cellspacing="0" cellpadding="0" style="background-color: #171717; border: 1px solid #262626; border-radius: 8px;">
                <tr>
                  <td style="padding: 6px 12px; font-size: 13px; font-family: monospace; color: #a3a3a3;">
                    Report Date: <strong style="color: #ffffff;">${metrics.reportDate}</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="48%" style="background-color: #171717; border: 1px solid #262626; border-radius: 12px; padding: 20px;">
                    <span style="font-size: 11px; font-family: monospace; color: #a3a3a3; text-transform: uppercase;">Monitored Properties</span>
                    <div style="font-size: 28px; font-weight: 700; color: #ffffff; margin-top: 4px;">${metrics.totalProperties} <span style="font-size: 13px; font-weight: normal; color: #737373;">Total</span></div>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background-color: #171717; border: 1px solid #262626; border-radius: 12px; padding: 20px;">
                    <span style="font-size: 11px; font-family: monospace; color: #38bdf8; text-transform: uppercase;">Projected MRR</span>
                    <div style="font-size: 28px; font-weight: 700; color: #38bdf8; margin-top: 4px;">${metrics.estimatedMrr} <span style="font-size: 13px; font-weight: normal; color: #737373;">USD</span></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 0 10px 0;">
              <h3 style="font-size: 14px; font-weight: 700; color: #ffffff; text-transform: uppercase; font-family: monospace; margin: 0 0 12px 0; border-bottom: 1px solid #262626; padding-bottom: 8px;">Active Subscription Footprint</h3>
              <table width="100%" border="0" cellspacing="0" cellpadding="8" style="font-size: 14px;">
                <tr style="border-bottom: 1px solid #1f1f1f;">
                  <td style="color: #38bdf8; padding-left: 0;">Zelle Audit Queue (Unapproved Pipeline)</td>
                  <td align="right" style="font-family: monospace; font-weight: bold; color: #38bdf8; padding-right: 0;">${metrics.pendingZelle} Transfers &middot; ${metrics.pipelineMrr}</td>
                </tr>
                <tr style="border-bottom: 1px solid #1f1f1f;">
                  <td style="color: #a3a3a3; padding-left: 0;">Free Access Tier (Limited Usage Ceilings)</td>
                  <td align="right" style="font-family: monospace; font-weight: bold; color: #ffffff; padding-right: 0;">${metrics.freeTierCount} Companies</td>
                </tr>
                <tr style="border-bottom: 1px solid #1f1f1f;">
                  <td style="color: #10b981; padding-left: 0;">Professional Tier (Pro Unlocked Full Use)</td>
                  <td align="right" style="font-family: monospace; font-weight: bold; color: #10b981; padding-right: 0;">${metrics.proTierCount} Companies</td>
                </tr>
                <tr>
                  <td style="color: #a3a3a3; padding-left: 0; padding-top: 12px; font-weight: bold;">Aggregate Account Conversion Velocity</td>
                  <td align="right" style="font-family: monospace; font-weight: bold; color: #ffffff; padding-top: 12px; padding-right: 0;">${metrics.conversionRate}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="border-top: 1px solid #262626; margin-top: 24px; padding-top: 20px; font-size: 11px; font-family: monospace; color: #525252; text-align: center;">
              This digest was compiled autonomously by RHS AI Solutions Engine instances.<br>
              Secure infrastructure operations logs connected to the tenant ledger partitions.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return NextResponse.json({ metrics, html });
}
