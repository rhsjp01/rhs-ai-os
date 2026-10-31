import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, logActivity } from '@/lib/auth';
import { isAdminRole } from '@/lib/tiers';

// GET /api/invoices — tenant-scoped billing records
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = isAdminRole(user.role);
  const where = admin ? {} : { companyId: user.companyId ?? 'none' };

  const invoices = await db.invoice.findMany({
    where,
    orderBy: { issuedDate: 'desc' },
    take: 60,
    include: {
      property: { select: { name: true } },
      company: { select: { name: true } },
    },
  });

  return NextResponse.json({
    invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      amount: i.amount,
      status: i.status,
      issuedDate: i.issuedDate.toISOString(),
      propertyName: i.property?.name ?? null,
      companyName: i.company.name,
    })),
  });
}

// POST /api/invoices — smart invoice generation
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const propertyId = typeof body?.propertyId === 'string' ? body.propertyId : null;
  const amount = typeof body?.amount === 'number' ? body.amount : NaN;

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'A positive invoice amount is required.' }, { status: 400 });
  }

  const companyId = user.companyId;
  if (!companyId) return NextResponse.json({ error: 'No tenant workspace bound.' }, { status: 400 });

  if (propertyId) {
    const property = await db.property.findUnique({ where: { id: propertyId } });
    if (!property || property.companyId !== companyId) {
      return NextResponse.json({ error: 'Property does not belong to this workspace.' }, { status: 403 });
    }
  }

  const count = await db.invoice.count({ where: { companyId } });
  const year = new Date().getFullYear();
  const invoiceNumber = `INV-${year}-${String(count + 1).padStart(3, '0')}`;

  const invoice = await db.invoice.create({
    data: {
      companyId,
      propertyId,
      invoiceNumber,
      amount: Math.round(amount * 100) / 100,
      status: 'draft',
    },
  });

  await logActivity(
    companyId,
    'invoice',
    'Invoice drafted',
    `${invoiceNumber} generated for $${(Math.round(amount * 100) / 100).toFixed(2)}.`,
  );

  return NextResponse.json({
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      status: invoice.status,
      issuedDate: invoice.issuedDate.toISOString(),
      propertyName: null,
      companyName: user.company?.name ?? '',
    },
  });
}
