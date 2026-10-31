import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Satellite orthomosaic generator — AI-generated aerial imagery for the
// Site Intelligence Hub. Images are cached on disk under db/satellite and
// streamed back through /api/satellite/[id].
// ---------------------------------------------------------------------------

const SATELLITE_DIR = path.join(process.cwd(), 'db', 'satellite');

export interface SatelliteSubject {
  id: string;
  name: string;
  address?: string | null;
  turfConditionScore?: number | null;
  drainageScore?: number | null;
}

function terrainClause(subject: SatelliteSubject): string {
  const turf = subject.turfConditionScore ?? 75;
  const drainage = subject.drainageScore ?? 70;
  const parts: string[] = [];
  if (turf >= 75) parts.push('lush healthy green turf coverage');
  else if (turf >= 60) parts.push('moderately green turf with a few dry patches');
  else parts.push('patchy brown stressed turf with bare dirt areas');
  if (drainage < 60) parts.push('visible standing water pooling in drainage swales and erosion channels');
  else if (drainage < 75) parts.push('minor water pooling near drainage lines');
  else parts.push('well-defined clean drainage channels');
  return parts.join(', ');
}

/**
 * Generates (or reuses) a satellite orthomosaic for a property.
 * Returns the API path that serves the image, or null on failure.
 */
export async function ensureSatelliteImage(subject: SatelliteSubject): Promise<string | null> {
  const filePath = path.join(SATELLITE_DIR, `${subject.id}.png`);
  if (fs.existsSync(filePath)) return `/api/satellite/${subject.id}`;
  try {
    const zai = await ZAI.create();
    const prompt = [
      'True-color satellite aerial orthomosaic, top-down nadir view of a commercial property parcel',
      `(${subject.name}${subject.address ? `, ${subject.address}` : ', North Carolina'})`,
      `showing ${terrainClause(subject)}`,
      'rooftops, parking areas, tree lines and service roads clearly visible,',
      'high-resolution earth observation imagery, crisp detail, realistic colors, no text or labels',
    ].join(' ');
    const response = await zai.images.generations.create({ prompt, size: '1344x768' });
    const base64 = response.data?.[0]?.base64;
    if (!base64) return null;
    fs.mkdirSync(SATELLITE_DIR, { recursive: true });
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
    return `/api/satellite/${subject.id}`;
  } catch {
    return null;
  }
}
