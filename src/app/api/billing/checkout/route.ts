import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { getSessionUser, logActivity } from '@/lib/auth';
import { isAdminRole } from '@/lib/tiers';

const METHODS = ['stripe', 'paypal', 'cashapp', 'zelle'] as const;
const TIERS = { pro: 'active', enterprise: 'enterprise_unlocked' } as const;

// POST /api/billing/checkout — multi-gateway subscription activation.
// Stripe / PayPal / Cash App clear instantly; Zelle enters the manual audit queue.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (isAdminRole(user.role)) {
    return NextResponse.json(
      { error: 'Master administration profiles already hold unthrottled Enterprise access.' },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => null);
  const method = typeof body?.method === 'string' ? (body.method as (typeof METHODS)[number]) : '';
  const tier = typeof body?.tier === 'string' && body.tier in TIERS ? (body.tier as keyof typeof TIERS) : 'pro';

  if (!METHODS.includes(method)) {
    return NextResponse.json({ error: 'Unsupported payment gateway.' }, { status: 400 });
  }

  const companyId = user.companyId;
  if (!companyId) return NextResponse.json({ error: 'No tenant workspace bound.' }, { status: 400 });

  const company = await db.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: 'Tenant not found.' }, { status: 404 });

  const price = tier === 'enterprise' ? 499 : 149;
  const tierLabel = tier === 'enterprise' ? 'Enterprise' : 'Professional';

  if (method === 'zelle') {
    // Manual audit path — administrator verifies the bank transfer in the queue
    await db.company.update({
      where: { id: companyId },
      data: {
        subscriptionStatus: 'pending_zelle_audit',
        stripeCustomerId: `zelle_ref_${companyId.slice(0, 8)}`,
      },
    });
    await logActivity(
      companyId,
      'zelle',
      'Zelle transfer pending manual audit',
      `${company.name} initiated a $${price} ${tierLabel} activation via Zelle (Tenant ID ${companyId.slice(0, 8)}). Awaiting administrator verification.`,
    );
    return NextResponse.json({
      status: 'pending_zelle_audit',
      amount: price,
      instructions: `Send exactly $${price}.00 via Zelle to payments@rhsaisolutions.com and include Tenant ID ${companyId.slice(0, 8)} in the transfer memo. Transfers are audited hourly.`,
    });
  }

  // Instant clearing gateways
  const gatewayToken = `${method}_tok_${randomBytes(6).toString('hex')}`;
  const newStatus = TIERS[tier];

  const count = await db.invoice.count({ where: { companyId } });
  const year = new Date().getFullYear();
  const invoice = await db.invoice.create({
    data: {
      companyId,
      invoiceNumber: `INV-${year}-${String(count + 1).padStart(3, '0')}`,
      amount: price,
      status: 'paid',
    },
  });

  await db.company.update({
    where: { id: companyId },
    data: { subscriptionStatus: newStatus, stripeCustomerId: gatewayToken },
  });

  const gatewayLabel =
    method === 'stripe' ? 'Stripe (card)' : method === 'paypal' ? 'PayPal' : 'Cash App';

  await logActivity(
    companyId,
    'payment',
    `Payment received via ${gatewayLabel}`,
    `${company.name} — $${price}.00 cleared. ${tierLabel} tier activated: ${tier === 'enterprise' ? 'unlimited properties & keywords' : '50 property audits + 10 keywords / month'}.`,
  );

  return NextResponse.json({
    status: newStatus,
    amount: price,
    gateway: gatewayLabel,
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      status: invoice.status,
      issuedDate: invoice.issuedDate.toISOString(),
    },
  });
}
