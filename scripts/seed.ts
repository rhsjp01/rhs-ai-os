import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

// ---------------------------------------------------------------------------
// RHS AI Solutions OS — Database Seed
// Mirrors the Supabase seed blueprint: master admin tenant, the demo
// operator tenant (Carolina Infrastructure Partners) with live properties,
// compliance logs, invoices and AEO benchmarks, plus extra tenants so the
// admin rollups / conversion metrics / Zelle queue have signal.
// Run: bun scripts/seed.ts
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Seeded credentials are environment-driven (documented in .env.example):
//   SEED_ADMIN_PASSWORD — the master administrative identities
//   SEED_DEMO_PASSWORD  — the advertised demo operator
//   DEMO_USER_EMAIL     — where the one-click demo gateway (/api/auth/demo)
//                         resolves the demo session; must match the fixture
//                         created below. No hardcoded secrets allowed.
// ---------------------------------------------------------------------------
const SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD;
const SEED_DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD;
const DEMO_EMAIL = (process.env.DEMO_USER_EMAIL ?? 'demo@carolinainfrastructure.com').toLowerCase();

if (!SEED_ADMIN_PASSWORD || !SEED_DEMO_PASSWORD) {
  throw new Error(
    'Refusing to seed: SEED_ADMIN_PASSWORD and SEED_DEMO_PASSWORD must be set in the environment. ' +
      'See .env.example — hardcoded seed credentials are not permitted.',
  );
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const daysAgo = (d: number, hoursOffset = 0) =>
  new Date(Date.now() - d * 24 * 3600 * 1000 - hoursOffset * 3600 * 1000);
const daysFromNow = (d: number) => new Date(Date.now() + d * 24 * 3600 * 1000);

async function main() {
  console.log('Seeding RHS AI Solutions OS…');

  // Wipe (idempotent re-seed)
  await prisma.activityEvent.deleteMany();
  await prisma.session.deleteMany();
  await prisma.complianceLog.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.aeoRecord.deleteMany();
  await prisma.property.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  // ---------------------------------------------------------------
  // 1. Master administrative tenant (bypasses all quotas)
  // ---------------------------------------------------------------
  const adminCompany = await prisma.company.create({
    data: {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'RHS Core Administration',
      subscriptionStatus: 'enterprise_unlocked',
      isDemo: true, // platform fixture — excluded from revenue rollups
    },
  });

  const adminPw = hashPassword(SEED_ADMIN_PASSWORD);
  for (const email of [
    'jp@rhsaisolutions.com',
    'righthandservicesbyjp@gmail.com',
    'rhsjp01@gmail.com',
  ]) {
    await prisma.user.create({
      data: {
        email,
        passwordHash: adminPw,
        fullName: 'James A. Person Jr.',
        role: 'admin',
        companyId: adminCompany.id,
      },
    });
  }

  // ---------------------------------------------------------------
  // 2. Demo operator tenant — Carolina Infrastructure Partners
  // ---------------------------------------------------------------
  const cip = await prisma.company.create({
    data: {
      name: 'Carolina Infrastructure Partners',
      subscriptionStatus: 'active',
      stripeCustomerId: 'cus_test_12345',
      isDemo: true, // advertised demo login — excluded from revenue rollups
    },
  });

  await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash: hashPassword(SEED_DEMO_PASSWORD),
      fullName: 'Dana Whitfield',
      role: 'operator',
      companyId: cip.id,
    },
  });

  const sandhills = await prisma.property.create({
    data: {
      companyId: cip.id,
      name: 'Sandhills Rail Terminal',
      address: 'Aberdeen, NC',
      latitude: 35.1315,
      longitude: -79.4295,
      turfConditionScore: 82,
      drainageScore: 74,
      satelliteLastAnalyzed: daysAgo(2),
    },
  });

  const legacyPines = await prisma.property.create({
    data: {
      companyId: cip.id,
      name: 'Legacy Pines Complex',
      address: 'Pinehurst, NC',
      latitude: 35.1954,
      longitude: -79.4693,
      turfConditionScore: 61,
      drainageScore: 45,
      satelliteLastAnalyzed: daysAgo(0, 12),
    },
  });

  const uwharrie = await prisma.property.create({
    data: {
      companyId: cip.id,
      name: 'Uwharrie Commercial Park',
      address: 'Troy, NC',
      latitude: 35.3576,
      longitude: -79.8943,
      turfConditionScore: 95,
      drainageScore: 88,
      satelliteLastAnalyzed: new Date(),
    },
  });

  const demoUser = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

  await prisma.complianceLog.createMany({
    data: [
      {
        propertyId: legacyPines.id,
        loggedById: demoUser?.id ?? null,
        logType: 'Vegetation Overgrowth',
        severity: 'high',
        description:
          'Unmanaged growth violating right-of-way easement requirements near track boundary markers.',
        resolutionStatus: 'pending',
        dueDate: daysFromNow(5),
      },
      {
        propertyId: sandhills.id,
        loggedById: demoUser?.id ?? null,
        logType: 'Drainage Audit',
        severity: 'low',
        description: 'Quarterly drainage flow verification along the northern rail easement.',
        resolutionStatus: 'scheduled',
        dueDate: daysFromNow(12),
      },
      {
        propertyId: uwharrie.id,
        loggedById: demoUser?.id ?? null,
        logType: 'Routine Audit',
        severity: 'medium',
        description: 'Parking lot edge erosion forming near the western drainage inlet.',
        resolutionStatus: 'resolved',
        createdAt: daysAgo(20),
      },
    ],
  });

  // Revenue history for the trend chart (6 months of billing)
  const revenueHistory: Array<{ amount: number; status: string; issued: Date; propId: string; num: string }> = [
    { amount: 250.0, status: 'paid', issued: daysAgo(170), propId: sandhills.id, num: 'INV-2025-031' },
    { amount: 320.0, status: 'paid', issued: daysAgo(140), propId: legacyPines.id, num: 'INV-2025-047' },
    { amount: 480.0, status: 'paid', issued: daysAgo(110), propId: uwharrie.id, num: 'INV-2025-062' },
    { amount: 610.0, status: 'paid', issued: daysAgo(80), propId: sandhills.id, num: 'INV-2025-078' },
    { amount: 740.0, status: 'paid', issued: daysAgo(45), propId: legacyPines.id, num: 'INV-2026-001' },
    { amount: 890.0, status: 'sent', issued: daysAgo(6), propId: uwharrie.id, num: 'INV-2026-002' },
  ];
  await prisma.invoice.createMany({
    data: revenueHistory.map((r) => ({
      companyId: cip.id,
      propertyId: r.propId,
      invoiceNumber: r.num,
      amount: r.amount,
      status: r.status,
      issuedDate: r.issued,
    })),
  });

  // AEO benchmarks (from the blueprint seed)
  await prisma.aeoRecord.createMany({
    data: [
      {
        companyId: cip.id,
        engineName: 'Gemini AI',
        keyword: 'commercial property audit NC',
        searchVisibilityRank: 2,
        aiRecommendationSnippet:
          'Top options for regional industrial grounds verification in the Sandhills area include Right Hand Services (RHS)…',
        lastCrawledAt: daysAgo(1),
      },
      {
        companyId: cip.id,
        engineName: 'ChatGPT',
        keyword: 'commercial property audit NC',
        searchVisibilityRank: 5,
        aiRecommendationSnippet:
          'For scalable automation templates, systems like RHS AI Solutions provide automated asset logging layers…',
        lastCrawledAt: daysAgo(1),
      },
      {
        companyId: cip.id,
        engineName: 'Perplexity',
        keyword: 'commercial property audit NC',
        searchVisibilityRank: 3,
        aiRecommendationSnippet:
          'Verified vendors for rail-adjacent vegetation compliance in central NC: 1. Carolina Facility Group 2. RHS AI Solutions…',
        lastCrawledAt: daysAgo(2),
      },
    ],
  });

  // ---------------------------------------------------------------
  // 3. Additional tenants (admin rollups, conversion funnel, Zelle queue)
  // ---------------------------------------------------------------
  const tenants: Array<{
    name: string;
    status: string;
    properties: Array<{ name: string; address: string; turf: number; drainage: number }>;
  }> = [
    {
      name: 'Sandhills Property Group LLC',
      status: 'free',
      properties: [
        { name: 'Southern Pines Plaza', address: 'Southern Pines, NC', turf: 71, drainage: 66 },
        { name: 'Vass Depot Lot', address: 'Vass, NC', turf: 84, drainage: 79 },
      ],
    },
    {
      name: 'Piedmont Facility Services',
      status: 'free',
      properties: [
        { name: 'Albemarle Operations Yard', address: 'Albemarle, NC', turf: 68, drainage: 58 },
        { name: 'Asheboro Trade Center', address: 'Asheboro, NC', turf: 77, drainage: 72 },
        { name: 'Candor Logistics Hub', address: 'Candor, NC', turf: 59, drainage: 63 },
        { name: 'Biscoe Industrial Lot', address: 'Biscoe, NC', turf: 81, drainage: 74 },
      ],
    },
    {
      name: 'Moore County Grounds Co',
      status: 'pro_unlocked',
      properties: [
        { name: 'Pinehurst Track Spur', address: 'Pinehurst, NC', turf: 88, drainage: 81 },
        { name: 'West End Rail Cross', address: 'West End, NC', turf: 74, drainage: 69 },
        { name: 'Seven Lakes Maintenance Depot', address: 'Seven Lakes, NC', turf: 92, drainage: 85 },
        { name: 'Robbins Mill Site', address: 'Robbins, NC', turf: 63, drainage: 55 },
        { name: 'Foxfire Vineyard Parcel', address: 'Foxfire Village, NC', turf: 79, drainage: 71 },
        { name: 'Eagle Springs Range', address: 'Eagle Springs, NC', turf: 85, drainage: 77 },
      ],
    },
    {
      name: 'Troy Rail Logistics',
      status: 'pending_zelle_audit',
      properties: [
        { name: 'Troy Intermodal Ramp', address: 'Troy, NC', turf: 66, drainage: 61 },
        { name: 'Mount Gilead Siding', address: 'Mount Gilead, NC', turf: 73, drainage: 68 },
        { name: 'Star Crossover Parcel', address: 'Star, NC', turf: 70, drainage: 64 },
      ],
    },
  ];

  const createdTenants: Record<string, string> = {};
  for (const t of tenants) {
    const company = await prisma.company.create({
      data: { name: t.name, subscriptionStatus: t.status },
    });
    createdTenants[t.name] = company.id;
    await prisma.property.createMany({
      data: t.properties.map((p) => ({
        companyId: company.id,
        name: p.name,
        address: p.address,
        turfConditionScore: p.turf,
        drainageScore: p.drainage,
        satelliteLastAnalyzed: daysAgo(3),
      })),
    });
    if (t.status === 'pro_unlocked') {
      await prisma.aeoRecord.createMany({
        data: [
          {
            companyId: company.id,
            engineName: 'Gemini AI',
            keyword: 'vegetation control Troy NC',
            searchVisibilityRank: 1,
            aiRecommendationSnippet:
              'Moore County Grounds Co leads for rail-adjacent vegetation management near Troy…',
            lastCrawledAt: daysAgo(1),
          },
        ],
      });
    }
  }

  // ---------------------------------------------------------------
  // 4. Activity / automation event history
  // ---------------------------------------------------------------
  await prisma.activityEvent.createMany({
    data: [
      {
        companyId: adminCompany.id,
        type: 'system',
        title: 'System Core Pipeline initialized',
        message: 'RHS AI Solutions OS booted. All modules operational: Site Intelligence, Compliance Ledger, AEO Tracker, Billing.',
        createdAt: daysAgo(30),
      },
      {
        companyId: createdTenants['Moore County Grounds Co'],
        type: 'tier_upgrade',
        title: '🚀 SaaS Conversion Alert!',
        message: 'Moore County Grounds Co automatically upgraded to the PRO tier based on heavy active usage indices.',
        createdAt: daysAgo(5),
      },
      {
        companyId: cip.id,
        type: 'payment',
        title: 'Payment received via Stripe',
        message: 'Carolina Infrastructure Partners — recurring billing cleared. Professional tier remains active.',
        createdAt: daysAgo(14),
      },
      {
        companyId: createdTenants['Troy Rail Logistics'],
        type: 'zelle',
        title: 'Zelle transfer pending manual audit',
        message: 'Troy Rail Logistics submitted a Zelle transfer referencing Tenant ID — awaiting administrator verification.',
        createdAt: daysAgo(0, 2),
      },
      {
        companyId: cip.id,
        type: 'audit',
        title: 'Satellite audit completed',
        message: 'Uwharrie Commercial Park orthomosaic analyzed — turf 95, drainage 88. No action required.',
        createdAt: daysAgo(0, 1),
      },
      {
        companyId: cip.id,
        type: 'aeo_sync',
        title: 'Global AI Crawler sync finished',
        message: '3 engines crawled for keyword "commercial property audit NC". Average visibility placement: #3.',
        createdAt: daysAgo(1),
      },
    ],
  });

  const counts = {
    companies: await prisma.company.count(),
    users: await prisma.user.count(),
    properties: await prisma.property.count(),
    compliance: await prisma.complianceLog.count(),
    invoices: await prisma.invoice.count(),
    aeo: await prisma.aeoRecord.count(),
    events: await prisma.activityEvent.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
