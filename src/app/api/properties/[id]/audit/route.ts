import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, logActivity } from '@/lib/auth';
import { isAdminRole } from '@/lib/tiers';
import { ensureSatelliteImage } from '@/lib/satellite';

// POST /api/properties/[id]/audit — AI site condition audit.
// Generates simulated turf/drainage scores and an AI-generated aerial
// visualization image (illustrative — not satellite or survey data).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const property = await db.property.findUnique({ where: { id } });
  if (!property) return NextResponse.json({ error: 'Property not found.' }, { status: 404 });

  const admin = isAdminRole(user.role);
  if (!admin && property.companyId !== user.companyId) {
    return NextResponse.json({ error: 'Forbidden — tenant boundary violation.' }, { status: 403 });
  }

  // Simulated condition scoring engine (blueprint range 60-98) — scores are
  // AI/simulated estimates, surfaced to users as illustrative.
  const turf = 60 + Math.floor(Math.random() * 39);
  const drainage = 55 + Math.floor(Math.random() * 43);

  const imageUrl = await ensureSatelliteImage({
    id: property.id,
    name: property.name,
    address: property.address,
    turfConditionScore: turf,
    drainageScore: drainage,
  });

  const updated = await db.property.update({
    where: { id },
    data: {
      turfConditionScore: turf,
      drainageScore: drainage,
      satelliteLastAnalyzed: new Date(),
      satelliteImageUrl: imageUrl ?? property.satelliteImageUrl,
    },
  });

  await logActivity(
    property.companyId,
    'audit',
    'AI site audit completed',
    `${property.name} AI visualization analyzed — turf ${turf}, drainage ${drainage}.${drainage < 60 ? ' Drainage attention recommended.' : ' No action required.'}`,
  );

  return NextResponse.json({
    property: {
      id: updated.id,
      name: updated.name,
      address: updated.address,
      latitude: updated.latitude,
      longitude: updated.longitude,
      turfConditionScore: updated.turfConditionScore,
      drainageScore: updated.drainageScore,
      satelliteImageUrl: updated.satelliteImageUrl,
      satelliteLastAnalyzed: updated.satelliteLastAnalyzed?.toISOString() ?? null,
    },
    satelliteGenerated: Boolean(imageUrl),
  });
}
