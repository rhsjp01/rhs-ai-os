'use client';

import {
  Satellite,
  AlertTriangle,
  DollarSign,
  Bot,
  TrendingUp,
  Users,
  Activity,
  Rocket,
  CreditCard,
  FileText,
  Zap,
  Bell,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { api, useMe } from '@/lib/rhs/api';
import type { OverviewResponse } from '@/lib/rhs/types';
import { useRhsStore } from '@/lib/rhs/store';
import { money, relativeTime } from '@/lib/rhs/format';
import { StatCard, SectionCard, QuotaMeter, TierBadge, GradientButton, EmptyState } from '../ui-bits';

const EVENT_ICONS: Record<string, React.ElementType> = {
  tier_upgrade: Rocket,
  payment: CreditCard,
  audit: Satellite,
  aeo_sync: Bot,
  zelle: Bell,
  compliance: FileText,
  invoice: DollarSign,
  system: Activity,
};

export function OverviewView() {
  const me = useMe();
  const { data } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api<OverviewResponse>('/overview'),
  });
  const setView = useRhsStore((s) => s.setView);
  const setUpgrade = useRhsStore((s) => s.setUpgrade);

  if (!data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  const isFree = data.tier.key === 'free' || data.tier.key === 'past_due' || data.tier.key === 'pending_zelle_audit';

  const chartTooltipStyle = {
    backgroundColor: '#171717',
    border: '1px solid #262626',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#e5e5e5',
  };

  return (
    <div className="space-y-6">
      {/* Metric hub */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Monitored Assets"
          value={data.propertyCount}
          sub={
            data.propertyLimit !== null ? (
              <QuotaMeter
                used={data.propertyCount}
                limit={data.propertyLimit}
                freeLabel="Site intel tokens"
                paidLabel="Properties under audit"
              />
            ) : (
              'Unlimited tier — no ceiling'
            )
          }
          icon={<Satellite className="w-4 h-4" />}
        />
        <StatCard
          label="Compliance Alerts"
          value={data.pendingCompliance}
          accent="text-amber-500"
          sub={
            <>
              {data.criticalCompliance > 0 ? (
                <span className="text-red-400 font-mono">{data.criticalCompliance} critical · </span>
              ) : null}
              <span>open liabilities</span>
            </>
          }
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <StatCard
          label={data.isAdmin ? 'Platform MRR (verified)' : 'Revenue Collected'}
          value={data.isAdmin ? money(data.mrr) : money(data.paidRevenue)}
          accent="text-emerald-400"
          sub={
            data.isAdmin ? (
              <>
                <span className="text-cyan-400 font-mono">{money(data.pipelineMrr)} pipeline · </span>
                <span className="text-amber-500 font-mono">{money(data.atRiskMrr)} at-risk</span>
              </>
            ) : (
              <span>{money(data.outstanding)} outstanding</span>
            )
          }
          icon={<DollarSign className="w-4 h-4" />}
        />
        <StatCard
          label="AEO Visibility Index (simulated)"
          value={data.aeoAvgRank ? `Top ${data.aeoAvgRank}` : '—'}
          accent="text-cyan-400"
          sub={`${data.aeoTracked} keyword${data.aeoTracked === 1 ? '' : 's'} tracked · LLM-simulated estimates`}
          icon={<Bot className="w-4 h-4" />}
        />
      </div>

      {/* Admin-only platform health strip */}
      {data.isAdmin ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Conversion Velocity"
            value={`${data.conversionRate}%`}
            accent="text-cyan-400"
            sub="Free → paid auto transitions"
            icon={<TrendingUp className="w-4 h-4" />}
          />
          <StatCard
            label="Portfolio Turf Average"
            value={data.avgTurf !== null ? `${data.avgTurf}%` : '—'}
            sub={`Drainage average ${data.avgDrainage !== null ? `${data.avgDrainage}%` : '—'}`}
            icon={<Satellite className="w-4 h-4" />}
          />
          <StatCard
            label="Billed Volume"
            value={money(data.paidRevenue)}
            sub="Cumulative settled invoices"
            icon={<Users className="w-4 h-4" />}
          />
        </div>
      ) : null}

      {/* Free tier upgrade banner */}
      {isFree && me.data ? (
        <div className="bg-gradient-to-r from-emerald-950/60 via-neutral-900 to-cyan-950/40 border border-emerald-900/60 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              You are on the {data.tier.label} tier
            </p>
            <p className="text-xs text-neutral-400 mt-1 max-w-lg">
              5 property audit tokens · 1 AEO keyword (manual trigger) · view-only compliance ledger. Upgrade to
              Professional for 50 monthly audits, 10 auto-synced keywords and full read/write access.
            </p>
          </div>
          <GradientButton onClick={() => setView('billing')}>View Upgrade Paths</GradientButton>
        </div>
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectionCard
          title="💵 Revenue Trajectory"
          description={data.isAdmin ? 'Platform-wide settled billing, trailing 6 months.' : 'Settled billing history for your workspace, trailing 6 months.'}
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="#737373" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#737373" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => [money(v), 'Revenue']} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#revGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="🛰️ Site Scorecard"
          description="Turf health and drainage flow grading across monitored properties."
        >
          <div className="h-56">
            {data.propertyScores.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.propertyScores} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    stroke="#737373"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tickFormatter={(v: string) => (v.length > 12 ? `${v.slice(0, 11)}…` : v)}
                  />
                  <YAxis stroke="#737373" fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#a3a3a3' }} />
                  <Bar dataKey="turf" name="Turf" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="drainage" name="Drainage" fill="#22d3ee" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState>
                No audited properties yet — add a site in the Site Intelligence Hub to begin scoring.
              </EmptyState>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Activity feed */}
      <SectionCard
        title="⚡ Live Automation Feed"
        description="Conversion alerts, payment events and audit results — streamed from the activity ledger."
        action={
          me.data?.tier ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-neutral-500 uppercase">Current tier</span>
              <TierBadge status={me.data.tier.key} />
            </div>
          ) : null
        }
      >
        {data.recentEvents.length === 0 ? (
          <EmptyState>No automation events recorded yet.</EmptyState>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto rhs-scroll pr-1">
            {data.recentEvents.map((event) => {
              const Icon = EVENT_ICONS[event.type] ?? Activity;
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 bg-neutral-950 border border-neutral-800 p-3.5 rounded-lg"
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white truncate">{event.title}</p>
                      <span className="text-[10px] font-mono text-neutral-600 shrink-0">
                        {relativeTime(event.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{event.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
