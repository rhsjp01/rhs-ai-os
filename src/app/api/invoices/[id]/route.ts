import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, logActivity } from '@/lib/auth';
import { isAdminRole } from '@/lib/tiers';

const ALLOWED_STATUSES = ['draft', 'sent', 'paid', 'overdue'];

// PATCH /api/invoices/[id] — status transitions (draft → sent → paid)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = typeof body?.status === 'string' ? body.status : '';

  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Invalid invoice status.' }, { status: 400 });
  }

  const invoice = await db.invoice.findUnique({ where: { id }, include: { company: true } });
  if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });

  const admin = isAdminRole(user.role);
  if (!admin && invoice.companyId !== user.companyId) {
    return NextResponse.json({ error: 'Forbidden — tenant boundary violation.' }, { status: 403 });
  }

  const updated = await db.invoice.update({ where: { id }, data: { status } });

  if (status === 'paid') {
    await logActivity(
      invoice.companyId,
      'invoice',
      'Payment recorded',
      `${invoice.invoiceNumber} settled — $${invoice.amount.toFixed(2)} credited to the ledger.`,
    );
  }

  return NextResponse.json({ ok: true, status: updated.status });
}
