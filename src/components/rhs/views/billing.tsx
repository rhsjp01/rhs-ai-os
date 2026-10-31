'use client';

import { useState } from 'react';
import { Check, CreditCard, Wallet, Landmark, Banknote, Zap, Loader2, ShieldCheck } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { post, useMe } from '@/lib/rhs/api';
import type { CheckoutResult } from '@/lib/rhs/types';
import { useRhsStore } from '@/lib/rhs/store';
import { money } from '@/lib/rhs/format';
import { SectionCard, TierBadge, GradientButton } from '../ui-bits';
import { cn } from '@/lib/utils';

type PaymentMethod = 'stripe' | 'paypal' | 'cashapp' | 'zelle';

const METHODS: Array<{
  key: PaymentMethod;
  label: string;
  sub: string;
  icon: React.ElementType;
  accent: string;
  selectedAccent: string;
}> = [
  {
    key: 'stripe',
    label: 'Credit / Debit Card',
    sub: 'via Stripe',
    icon: CreditCard,
    accent: 'text-emerald-400',
    selectedAccent: 'border-emerald-500 bg-emerald-950/20',
  },
  {
    key: 'paypal',
    label: 'PayPal Ecosystem',
    sub: 'instant access',
    icon: Wallet,
    accent: 'text-sky-400',
    selectedAccent: 'border-sky-500 bg-sky-950/20',
  },
  {
    key: 'cashapp',
    label: 'Cash App',
    sub: 'instant access',
    icon: Banknote,
    accent: 'text-lime-400',
    selectedAccent: 'border-lime-500 bg-lime-950/20',
  },
  {
    key: 'zelle',
    label: 'Zelle Direct Bank Transfer',
    sub: 'manual audit (1-12 hours)',
    icon: Landmark,
    accent: 'text-violet-400',
    selectedAccent: 'border-violet-500 bg-violet-950/20',
  },
];

const TIERS = [
  {
    key: 'free',
    name: 'Free — Discovery',
    price: 0,
    audience: 'Solo contractors & builders',
    features: [
      '5 property audits (total)',
      '1 AEO keyword (manual trigger)',
      'Compliance logs (view-only)',
      'No card required',
    ],
  },
  {
    key: 'pro',
    name: 'Professional — Growth',
    price: 149,
    audience: 'Mid-sized regional trades',
    features: [
      'Up to 50 properties / month',
      '10 keywords (auto-sync daily)',
      'Full read/write compliance + PDF export',
      'Automated recurring re-billing',
    ],
    highlight: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise — Full Use',
    price: 499,
    audience: 'Infrastructure teams & portfolios',
    features: [
      'Unlimited property analysis',
      'Unlimited keywords (real-time tracking)',
      'Full auditing + multi-tenant sub-accounts',
      'Tailored corporate invoicing hooks',
    ],
  },
];

export function BillingView() {
  const me = useMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [method, setMethod] = useState<PaymentMethod>('stripe');
  const [targetTier, setTargetTier] = useState<'pro' | 'enterprise'>('pro');
  const [result, setResult] = useState<CheckoutResult | null>(null);

  const currentTier = me.data?.tier.key ?? 'free';
  const isAdmin = me.data?.isAdmin ?? false;
  const paidAlready = ['active', 'pro_unlocked', 'enterprise_unlocked'].includes(currentTier);
  const companyId = me.data?.user.companyId ?? '';

  const checkout = useMutation({
    mutationFn: () => post<CheckoutResult>('/billing/checkout', { method, tier: targetTier }),
    onSuccess: (res) => {
      setResult(res);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-zelle'] });
      if (res.status === 'pending_zelle_audit') {
        toast({
          title: 'Zelle transfer submitted',
          description: 'Awaiting manual audit — administrators verify transfers hourly.',
        });
      } else {
        toast({
          title: 'Payment cleared',
          description: `${res.gateway} — ${money(res.amount)} received. Tier activated.`,
        });
      }
    },
    onError: (err) =>
      toast({
        title: 'Checkout failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      }),
  });

  const price = targetTier === 'enterprise' ? 499 : 149;

  if (result) {
    const pending = result.status === 'pending_zelle_audit';
    return (
      <div className="max-w-xl mx-auto pt-8">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center shadow-2xl">
          <div
            className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border',
              pending
                ? 'bg-violet-500/10 border-violet-500/30 text-violet-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
            )}
          >
            {pending ? <Landmark className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
          </div>
          <h3 className="text-xl font-extrabold text-white">
            {pending ? 'Zelle Transfer Pending Audit' : 'Tier Activation Confirmed'}
          </h3>
          <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
            {pending
              ? result.instructions
              : `${money(result.amount)} settled via ${result.gateway}. Invoice ${result.invoice?.invoiceNumber} has been posted to your ledger.`}
          </p>
          {!pending ? (
            <div className="mt-5 bg-neutral-950 border border-neutral-800 rounded-lg p-4 text-left font-mono text-xs text-neutral-300 space-y-1.5">
              <p className="flex justify-between">
                <span className="text-neutral-500">TRANSACTION STATUS</span>
                <span className="text-emerald-400">[ PAID / RECONCILED ]</span>
              </p>
              <p className="flex justify-between">
                <span className="text-neutral-500">AMOUNT CREDITED</span>
                <span>{money(result.amount, { decimals: 2 })} USD</span>
              </p>
              <p className="flex justify-between">
                <span className="text-neutral-500">REFERENCE</span>
                <span>{result.invoice?.invoiceNumber}</span>
              </p>
            </div>
          ) : null}
          <button
            onClick={() => setResult(null)}
            className="mt-6 w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white font-medium text-sm rounded-xl transition-colors border border-neutral-800"
          >
            Return to Billing Center
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current status */}
      <SectionCard
        title="💳 Subscription & Gateway Control"
        description="Usage-limited freemium structure — experience the tooling firsthand, then unlock unthrottled access as value compounds."
        action={
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-neutral-500 uppercase">Current</span>
            <TierBadge status={currentTier} />
          </div>
        }
      >
        {isAdmin ? (
          <div className="bg-cyan-950/30 border border-cyan-900/50 rounded-lg p-4 text-sm text-cyan-200">
            Master administration profiles hold permanent, unthrottled Enterprise clearance — no billing
            lifecycle applies to the core platform tenant.
          </div>
        ) : paidAlready ? (
          <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-emerald-400">
                {currentTier === 'enterprise_unlocked' ? 'Enterprise — Full Use active' : 'Professional tier active'}
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">
                {currentTier === 'pro_unlocked'
                  ? 'Auto-unlocked through usage velocity. Recurring billing keeps the tier locked in.'
                  : 'Recurring re-billing is automated — card failures downgrade access automatically.'}
              </p>
            </div>
            <TierBadge status={currentTier} />
          </div>
        ) : (
          <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-4 text-sm text-amber-200">
            <Zap className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            {currentTier === 'pending_zelle_audit'
              ? 'A Zelle activation is pending manual audit — administrators verify transfers hourly.'
              : 'You are on the Free Discovery tier. Select an upgrade path below.'}
          </div>
        )}
      </SectionCard>

      {/* Tier matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {TIERS.map((tier) => {
          const isCurrent =
            (tier.key === 'free' && !paidAlready && !isAdmin) ||
            (tier.key === 'pro' && (currentTier === 'active' || currentTier === 'pro_unlocked')) ||
            (tier.key === 'enterprise' && currentTier === 'enterprise_unlocked');
          return (
            <div
              key={tier.key}
              className={cn(
                'bg-neutral-900 border rounded-xl p-5 flex flex-col',
                tier.highlight ? 'border-emerald-700/60' : 'border-neutral-800',
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-white">{tier.name}</h3>
                {isCurrent ? (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 uppercase">
                    Current
                  </span>
                ) : null}
              </div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-3xl font-extrabold text-white">{tier.price === 0 ? '$0' : `$${tier.price}`}</span>
                <span className="text-xs text-neutral-500">/ month</span>
              </div>
              <p className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider mb-4">{tier.audience}</p>
              <ul className="space-y-2 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-neutral-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {!isAdmin && !isCurrent && tier.key !== 'free' ? (
                <button
                  onClick={() => setTargetTier(tier.key as 'pro' | 'enterprise')}
                  className={cn(
                    'mt-5 w-full py-2.5 rounded-lg text-sm font-bold transition-all border',
                    targetTier === tier.key
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-neutral-950 border-transparent'
                      : 'bg-neutral-950 text-neutral-300 hover:text-white border-neutral-800',
                  )}
                >
                  {targetTier === tier.key ? 'Selected' : `Choose ${tier.key === 'pro' ? 'Professional' : 'Enterprise'}`}
                </button>
              ) : (
                <div className="mt-5" />
              )}
            </div>
          );
        })}
      </div>

      {/* Payment gateway selection */}
      {!isAdmin ? (
        <SectionCard
          title="Select Payment Gateway"
          description={`Activate ${targetTier === 'enterprise' ? 'Enterprise' : 'Professional'} tier access ($${price}/mo) using your preferred network.`}
        >
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} className="space-y-3">
            {METHODS.map((m) => {
              const Icon = m.icon;
              const selected = method === m.key;
              return (
                <Label
                  key={m.key}
                  htmlFor={`gateway-${m.key}`}
                  className={cn(
                    'flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all',
                    selected ? m.selectedAccent : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <RadioGroupItem id={`gateway-${m.key}`} value={m.key} className="border-neutral-600" />
                    <Icon className={cn('w-4.5 h-4.5 w-[18px] h-[18px]', m.accent)} />
                    <div>
                      <p className="text-sm font-bold text-white">{m.label}</p>
                      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">{m.sub}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase',
                      m.key === 'zelle'
                        ? 'text-violet-400 border-violet-900 bg-violet-950/50'
                        : 'text-emerald-400 border-emerald-900 bg-emerald-950/50',
                    )}
                  >
                    {m.key === 'zelle' ? 'Manual Audit' : 'Instant'}
                  </span>
                </Label>
              );
            })}
          </RadioGroup>

          {method === 'zelle' ? (
            <div className="mt-4 bg-violet-950/20 border border-violet-900/50 p-4 rounded-xl text-xs text-violet-300 font-medium leading-relaxed">
              <p className="font-bold text-violet-200 mb-1">💡 Zelle Instructions</p>
              Send ${price} to the business Zelle account and include your unique Tenant ID reference:{' '}
              <span className="font-mono text-white bg-neutral-950 px-1.5 py-0.5 rounded">
                {companyId.slice(0, 8)}…
              </span>{' '}
              in the transaction memo. Incoming transfers are audited hourly by platform administrators.
            </div>
          ) : null}

          <GradientButton
            className="w-full mt-5 !py-3.5"
            disabled={checkout.isPending || paidAlready}
            onClick={() => checkout.mutate()}
          >
            {checkout.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting Secure Checkout Nodes…
              </span>
            ) : paidAlready ? (
              'Tier Already Active'
            ) : (
              `Proceed to Checkout & Unlock — $${price}/mo`
            )}
          </GradientButton>
          <p className="text-[10px] font-mono text-neutral-600 text-center mt-3">
            Sandbox simulation — no live charges. Stripe / PayPal / Cash App clear instantly; Zelle enters the
            manual audit queue.
          </p>
        </SectionCard>
      ) : null}
    </div>
  );
}
