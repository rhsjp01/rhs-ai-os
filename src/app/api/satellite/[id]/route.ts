import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// GET /api/satellite/[id] — streams the cached orthomosaic for a property
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Guard against path traversal — ids are UUIDs
  if (!/^[a-zA-Z0-9-]+$/.test(id)) {
    return new NextResponse('Invalid asset reference', { status: 400 });
  }
  const filePath = path.join(process.cwd(), 'db', 'satellite', `${id}.png`);
  if (!fs.existsSync(filePath)) {
    return new NextResponse('Orthomosaic not yet generated', { status: 404 });
  }
  const buffer = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
