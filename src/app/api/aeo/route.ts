import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, logActivity } from '@/lib/auth';
import { TIER_CONFIG, isAdminRole, tierOf } from '@/lib/tiers';

// GET /api/aeo — tracked keyword rankings across AI engines
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = isAdminRole(user.role);
  const where = admin ? {} : { companyId: user.companyId ?? 'none' };

  const records = await db.aeoRecord.findMany({
    where,
    orderBy: [{ keyword: 'asc' }, { engineName: 'asc' }],
  });

  return NextResponse.json({
    records: records.map((r) => ({
      id: r.id,
      engineName: r.engineName,
      keyword: r.keyword,
      searchVisibilityRank: r.searchVisibilityRank,
      aiRecommendationSnippet: r.aiRecommendationSnippet,
      lastCrawledAt: r.lastCrawledAt.toISOString(),
    })),
  });
}

// POST /api/aeo — add a tracked keyword (subject to tier keyword limits)
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const keyword = typeof body?.keyword === 'string' ? body.keyword.trim() : '';

  if (!keyword || keyword.length < 3) {
    return NextResponse.json({ error: 'A keyword of at least 3 characters is required.' }, { status: 400 });
  }

  const companyId = user.companyId;
  if (!companyId) return NextResponse.json({ error: 'No tenant workspace bound.' }, { status: 400 });

  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });

  const admin = isAdminRole(user.role);
  const tier = TIER_CONFIG[tierOf(company.subscriptionStatus)];

  const existingKeywords = await db.aeoRecord.findMany({
    where: { companyId },
    select: { keyword: true },
  });
  const distinct = new Set(existingKeywords.map((r) => r.keyword.toLowerCase()));

  if (distinct.has(keyword.toLowerCase())) {
    return NextResponse.json({ error: 'This keyword is already being tracked.' }, { status: 409 });
  }

  if (!admin && distinct.size >= tier.keywordLimit) {
    return NextResponse.json(
      {
        code: 'KEYWORD_LIMIT',
        error: `Keyword tracking limit reached for ${tier.label} tier (${tier.keywordLimit}). Upgrade for automated multi-keyword sync.`,
        tier: tier.key,
        limit: tier.keywordLimit === Number.MAX_SAFE_INTEGER ? null : tier.keywordLimit,
      },
      { status: 403 },
    );
  }

  const record = await db.aeoRecord.create({
    data: { companyId, keyword, engineName: 'Gemini AI', searchVisibilityRank: null },
  });

  return NextResponse.json({
    record: {
      id: record.id,
      engineName: record.engineName,
      keyword: record.keyword,
      searchVisibilityRank: record.searchVisibilityRank,
      aiRecommendationSnippet: record.aiRecommendationSnippet,
      lastCrawledAt: record.lastCrawledAt.toISOString(),
    },
  });
}
