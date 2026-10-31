import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, logActivity } from '@/lib/auth';
import { isAdminRole } from '@/lib/tiers';
import { crawlAllEngines } from '@/lib/aeo-crawler';

// POST /api/aeo/sync — Global AI Crawler sync (LLM-simulated engine answers)
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = isAdminRole(user.role);
  const companyId = user.companyId;
  if (!companyId) return NextResponse.json({ error: 'No tenant workspace bound.' }, { status: 400 });

  // Admins sync platform-wide; tenants sync their own keywords
  const keywords = Array.from(
    new Set(
      (
        await db.aeoRecord.findMany({
          where: admin ? {} : { companyId },
          select: { keyword: true },
        })
      ).map((r) => r.keyword),
    ),
  );

  if (keywords.length === 0) {
    return NextResponse.json({ error: 'No keywords tracked yet. Add a keyword first.' }, { status: 400 });
  }

  // Crawl each keyword across all engines — keywords processed sequentially
  // (engines in parallel) to stay under the LLM gateway rate limit.
  const results = [];
  for (const keyword of keywords.slice(0, 10)) {
    const keywordResults = await crawlAllEngines(keyword);
    results.push(...keywordResults);
  }

  // Persist: upsert per (company-scope keyword + engine). Admin sync updates
  // every company's records for that keyword; tenant sync updates own records.
  let updatedCount = 0;
  let createdCount = 0;
  for (const result of results) {
    const targetFilter = admin
      ? { keyword: result.keyword, engineName: result.engineName }
      : { companyId, keyword: result.keyword, engineName: result.engineName };

    const existing = await db.aeoRecord.findMany({ where: targetFilter });
    if (existing.length > 0) {
      await db.aeoRecord.updateMany({
        where: { id: { in: existing.map((e) => e.id) } },
        data: {
          searchVisibilityRank: result.rank,
          aiRecommendationSnippet: result.snippet,
          lastCrawledAt: result.crawledAt,
        },
      });
      updatedCount += existing.length;
    } else {
      await db.aeoRecord.create({
        data: {
          companyId,
          keyword: result.keyword,
          engineName: result.engineName,
          searchVisibilityRank: result.rank,
          aiRecommendationSnippet: result.snippet,
          lastCrawledAt: result.crawledAt,
        },
      });
      createdCount += 1;
    }
  }

  const cited = results.filter((r) => r.rank != null);
  const avgRank = cited.length
    ? Math.round((cited.reduce((a, r) => a + (r.rank ?? 0), 0) / cited.length) * 10) / 10
    : null;

  await logActivity(
    admin ? null : companyId,
    'aeo_sync',
    'Global AI Crawler sync finished',
    `${results.length} engine crawls executed across ${keywords.length} keyword(s). Average visibility placement: ${avgRank ? `#${avgRank}` : 'not cited'}.`,
  );

  return NextResponse.json({
    crawled: results.length,
    updatedRecords: updatedCount + createdCount,
    avgRank,
    sourceBreakdown: {
      llm: results.filter((r) => r.source === 'llm').length,
      fallback: results.filter((r) => r.source === 'fallback').length,
    },
  });
}
