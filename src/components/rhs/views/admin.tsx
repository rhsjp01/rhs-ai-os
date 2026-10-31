'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  Rocket,
  CheckCircle2,
  XCircle,
  Mail,
  Copy,
  Loader2,
  RefreshCw,
  Building2,
  Activity,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api, post, patch } from '@/lib/rhs/api';
import type { AdminMetricsResponse, ZelleQueueItem, DigestResponse, ActivityEventRow } from '@/lib/rhs/types';
import { money, moneyExact, relativeTime, shortDate } from '@/lib/rhs/format';
import { StatCard, SectionCard, TierBadge, GradientButton, EmptyState } from '../ui-bits';
import { cn } from '@/lib/utils';

const EVENT_ICONS: Record<string, React.ElementType> = {
  tier_upgrade: Rocket,
  payment: CheckCircle2,
  zelle: Mail,
  audit: Activity,
  system: Activity,
};

const PITCH_TEMPLATE = `Subject: Automated exterior inspection report for {{ portfolio_name }} — {{ asset_count }} properties

Hi {{ contact_name }},

Managing grounds SLAs and vegetation liabilities across a distributed real estate portfolio usually requires constant site drives or relying entirely on unverified vendor updates.

At RHS AI Solutions, we've built a property intelligence platform that gives you an independent, photo-verified look at your entire footprint without requiring manual site inspections.

We ran a screening-level audit on your asset located at {{ sample_property_address }} and compiled a condition scorecard mapping out current turf performance ratings, structural drainage grades, and localized compliance risks.

You can access your complementary sample site audit dashboard here:
👉 https://rhsaisolutions.com/sample?id={{ generated_uuid }}

How we protect your margins:
• Validate Vendor SLAs: Know exactly if your landscape contractors are hitting agreed contract scopes before signing off on cross-regional billing logs.
• Prioritize Deferred Maintenance: Identify boundary overgrowth risks, grading shifts, and structural layout liabilities before they turn into expensive fines or municipal code compliance issues.
• One Dashboard Interface: Maintain a single, date-stamped ledger view for your field operators and executive teams simultaneously.

If you'd like to see how we can ingest and track your entire {{ market_name }} market portfolio under a single operational OS layer, let me know. I can unlock temporary access codes for your team to run up to 5 properties entirely free.

Best regards,
James A. Person Jr.
Founder, RHS AI Solutions
jp@rhsaisolutions.com | 317-395-3309
Candor, NC | AI recommends. Human review decides.`;

export function AdminView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [digest, setDigest] = useState<DigestResponse | null>(null);

  const metrics = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: () => api<AdminMetricsResponse>('/admin/metrics'),
    refetchInterval: 20_000,
  });

  const zelle = useQuery({
    queryKey: ['admin-zelle'],
    queryFn: () => api<{ queue: ZelleQueueItem[] }>('/admin/zelle'),
  });

  const compileDigest = useMutation({
    mutationFn: () => api<DigestResponse>('/automation/digest'),
    onSuccess: (data) => setDigest(data),
  });

  const overrideTier = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      patch(`/admin/companies/${id}`, { subscriptionStatus: status }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
      toast({ title: 'Tier override applied', description: 'The tenant ledger has been recalculated.' });
    },
    onError: (err) =>
      toast({
        title: 'Override failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      }),
  });

  const zelleAction = useMutation({
    mutationFn: ({ companyId, action }: { companyId: string; action: 'approve' | 'reject' }) =>
      post('/admin/zelle', { companyId, action }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-zelle'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
      void queryClient.invalidateQueries({ queryKey: ['overview'] });
      toast({
        title: res.status === 'active' ? 'Transfer approved — tier provisioned' : 'Transfer rejected — reverted to Free',
      });
    },
  });

  const totals = metrics.data?.totals;
  const chartTooltipStyle = {
    backgroundColor: '#171717',
    border: '1px solid #262626',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#e5e5e5',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
            🛡️ Administrative Core Control
          </h1>
          <p className="text-neutral-400 text-xs mt-0.5">
            Global tenant profiles, account status rollups &amp; financial health overview
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void metrics.refetch();
            void zelle.refetch();
            toast({ title: 'Account metrics refreshed' });
          }}
          className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-cyan-400"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refresh Account Metrics
        </Button>
      </div>

      <Tabs defaultValue="rollup" className="w-full">
        <TabsList className="bg-neutral-950 border border-neutral-800 w-full justify-start overflow-x-auto no-scrollbar h-auto p-1">
          {['rollup', 'tenants', 'zelle', 'digest', 'outreach'].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="data-[state=active]:bg-neutral-800 data-[state=active]:text-white text-neutral-400 text-xs capitalize px-4 py-1.5"
            >
              {tab === 'zelle' ? 'Zelle Queue' : tab === 'digest' ? 'Daily Digest' : tab === 'outreach' ? 'Outreach Kit' : tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ---------------- Rollup ---------------- */}
        <TabsContent value="rollup" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Aggregate Accounts"
              value={totals?.companies ?? '—'}
              sub={`${totals?.totalProperties ?? 0} properties monitored platform-wide`}
              icon={<Building2 className="w-4 h-4" />}
            />
            <StatCard
              label="Premium Accounts"
              value={totals?.proCount ?? '—'}
              accent="text-emerald-400"
              sub={`${totals?.enterpriseCount ?? 0} enterprise · ${totals?.pendingZelle ?? 0} zelle pending`}
              icon={<Rocket className="w-4 h-4" />}
            />
            <StatCard
              label="Conversion Rate"
              value={`${totals?.conversionRate ?? 0}%`}
              accent="text-cyan-400"
              sub="Free → paid account velocity"
              icon={<Activity className="w-4 h-4" />}
            />
            <StatCard
              label="Platform MRR"
              value={money(totals?.mrr ?? 0)}
              accent="text-emerald-400"
              sub={`${moneyExact(totals?.paidVolume ?? 0)} lifetime billed · verified transfers only`}
              icon={<CheckCircle2 className="w-4 h-4" />}
            />
          </div>

          {/* Revenue truth split — pipeline and at-risk money are never counted as MRR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-cyan-900/50 bg-cyan-950/20 p-4">
              <p className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">Pipeline MRR (Zelle pending)</p>
              <p className="text-2xl font-bold text-cyan-300 mt-1">{money(totals?.pipelineMrr ?? 0)}</p>
              <p className="text-[10px] text-neutral-500 mt-1 font-mono">{totals?.pendingZelle ?? 0} transfers awaiting audit — not revenue</p>
            </div>
            <div className="rounded-xl border border-amber-900/50 bg-amber-950/20 p-4">
              <p className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">At-Risk MRR (past due)</p>
              <p className="text-2xl font-bold text-amber-300 mt-1">{money(totals?.atRiskMrr ?? 0)}</p>
              <p className="text-[10px] text-neutral-500 mt-1 font-mono">{totals?.pastDueCount ?? 0} accounts behind on payment</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
              <p className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">Demo Fixtures Excluded</p>
              <p className="text-2xl font-bold text-neutral-300 mt-1">{totals?.demoCompanies ?? 0}</p>
              <p className="text-[10px] text-neutral-500 mt-1 font-mono">Showcase tenants hidden from revenue & conversion</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SectionCard
              title="⚡ Conversion & Automation Alerts"
              description="Live feed replacing the n8n notification pipeline — tier shifts, payments and Zelle audits stream here in real time."
            >
              <div className="space-y-2.5 max-h-96 overflow-y-auto rhs-scroll pr-1">
                {metrics.data?.alerts.map((alert: ActivityEventRow) => {
                  const Icon = EVENT_ICONS[alert.type] ?? Activity;
                  const highlight = alert.type === 'tier_upgrade' || alert.type === 'zelle';
                  return (
                    <div
                      key={alert.id}
                      className={cn(
                        'flex items-start gap-3 border p-3.5 rounded-lg',
                        highlight
                          ? 'bg-emerald-950/20 border-emerald-900/50'
                          : 'bg-neutral-950 border-neutral-800',
                      )}
                    >
                      <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0">
                        <Icon className={cn('w-4 h-4', highlight ? 'text-emerald-400' : 'text-neutral-500')} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white truncate">{alert.title}</p>
                          <span className="text-[10px] font-mono text-neutral-600 shrink-0">
                            {relativeTime(alert.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{alert.message}</p>
                        <p className="text-[10px] font-mono text-neutral-600 mt-1">{alert.companyName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="📊 Tier Distribution" description="Subscription footprint across active tenants.">
              <div className="space-y-3">
                {(metrics.data?.tierDistribution ?? []).map((entry) => {
                  const total = metrics.data?.totals.companies || 1;
                  const pct = Math.round((entry.value / total) * 100);
                  const barColor =
                    entry.name === 'Free'
                      ? 'bg-neutral-600'
                      : entry.name === 'Professional'
                        ? 'bg-emerald-500'
                        : entry.name === 'Enterprise'
                          ? 'bg-cyan-500'
                          : 'bg-violet-500';
                  return (
                    <div key={entry.name}>
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="text-neutral-300">{entry.name}</span>
                        <span className="text-neutral-500">
                          {entry.value} companies · {pct}%
                        </span>
                      </div>
                      <div className="w-full bg-neutral-800 h-2.5 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-3 border-t border-neutral-800 grid grid-cols-2 gap-3 text-center">
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                    <p className="text-[10px] font-mono text-neutral-500 uppercase">Free Accounts</p>
                    <p className="text-2xl font-bold text-white mt-1">{totals?.freeCount ?? 0}</p>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                    <p className="text-[10px] font-mono text-neutral-500 uppercase">Premium Accounts</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">
                      {(totals?.proCount ?? 0) + (totals?.enterpriseCount ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        {/* ---------------- Tenants ---------------- */}
        <TabsContent value="tenants" className="mt-4">
          <SectionCard
            title="🏢 Corporate Accounts Real-Time Log"
            description="Global tenant ledger — override any account tier status for administration or grace periods."
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-neutral-800 hover:bg-transparent">
                    <TableHead className="text-neutral-400 font-mono text-[11px] uppercase">Company</TableHead>
                    <TableHead className="text-neutral-400 font-mono text-[11px] uppercase text-center hidden sm:table-cell">
                      Properties
                    </TableHead>
                    <TableHead className="text-neutral-400 font-mono text-[11px] uppercase text-center hidden md:table-cell">
                      Users
                    </TableHead>
                    <TableHead className="text-neutral-400 font-mono text-[11px] uppercase hidden lg:table-cell">
                      Onboarded
                    </TableHead>
                    <TableHead className="text-neutral-400 font-mono text-[11px] uppercase text-right">Tier Override</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.data?.companies.map((c) => (
                    <TableRow key={c.id} className="border-neutral-800 hover:bg-neutral-950/60">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-[10px] font-mono font-bold text-emerald-400 uppercase shrink-0">
                            {c.name.slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{c.name}</p>
                            <p className="text-[10px] font-mono text-neutral-600">{c.id.slice(0, 18)}…</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm text-neutral-300 hidden sm:table-cell">
                        {c.propertyCount}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm text-neutral-300 hidden md:table-cell">
                        {c.userCount}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-neutral-500 hidden lg:table-cell">
                        {shortDate(c.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {c.isDemo ? (
                            <span className="text-[10px] font-mono text-violet-300 border border-violet-900 bg-violet-950/50 rounded px-1.5 py-0.5 hidden sm:inline-flex">
                              DEMO
                            </span>
                          ) : null}
                          <TierBadge status={c.subscriptionStatus} className="hidden sm:inline-flex" />
                          <Select
                            value={c.subscriptionStatus}
                            onValueChange={(value) => overrideTier.mutate({ id: c.id, status: value })}
                          >
                            <SelectTrigger className="w-36 h-8 bg-neutral-950 border-neutral-800 text-xs font-mono">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-neutral-900 border-neutral-800">
                              {['free', 'active', 'pro_unlocked', 'enterprise_unlocked', 'past_due', 'pending_zelle_audit'].map(
                                (s) => (
                                  <SelectItem key={s} value={s} className="text-xs font-mono">
                                    {s}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ---------------- Zelle queue ---------------- */}
        <TabsContent value="zelle" className="mt-4">
          <SectionCard
            title="💜 Zelle Manual Audit Queue"
            description="Cross-reference incoming banking logs with company reference IDs before activating premium access."
          >
            {zelle.isLoading ? (
              <div className="h-20 bg-neutral-950 rounded-xl animate-pulse" />
            ) : (zelle.data?.queue.length ?? 0) === 0 ? (
              <EmptyState>No pending Zelle bank verification logs detected.</EmptyState>
            ) : (
              <div className="space-y-3">
                {zelle.data?.queue.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col md:flex-row justify-between items-start md:items-center bg-neutral-950 border border-neutral-800 p-5 rounded-xl gap-4"
                  >
                    <div>
                      <h4 className="font-bold text-white text-sm">{item.name}</h4>
                      <p className="text-xs text-neutral-500 font-mono mt-0.5">
                        Tenant Key: {item.id.slice(0, 18)}… · Ref: {item.reference}
                      </p>
                      <p className="text-[10px] font-mono text-neutral-600 mt-1">
                        {item.propertyCount} properties · {item.userCount} users · requested{' '}
                        {relativeTime(item.requestedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={zelleAction.isPending}
                        onClick={() => zelleAction.mutate({ companyId: item.id, action: 'approve' })}
                        className="bg-violet-600 hover:bg-violet-700 text-white font-bold"
                      >
                        {zelleAction.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        )}
                        Approve &amp; Unlock Tier
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={zelleAction.isPending}
                        onClick={() => zelleAction.mutate({ companyId: item.id, action: 'reject' })}
                        className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800 hover:text-red-400"
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ---------------- Daily digest ---------------- */}
        <TabsContent value="digest" className="mt-4 space-y-6">
          <SectionCard
            title="📨 Daily 8:00 AM Digest Engine"
            description="Scheduled automation (replaces the n8n cron workflow) — compiles platform rollups and dispatches the tier summary email."
            action={
              <GradientButton onClick={() => compileDigest.mutate()} disabled={compileDigest.isPending}>
                {compileDigest.isPending ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Compiling…
                  </span>
                ) : (
                  'Compile Daily Digest'
                )}
              </GradientButton>
            }
          >
            {!digest ? (
              <EmptyState>
                Trigger the compiler to generate today&apos;s platform rollup and email payload preview.
              </EmptyState>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3.5">
                    <p className="text-[10px] font-mono text-neutral-500 uppercase">Report Date</p>
                    <p className="text-xs font-bold text-white mt-1">{digest.metrics.reportDate}</p>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3.5">
                    <p className="text-[10px] font-mono text-neutral-500 uppercase">Monitored Properties</p>
                    <p className="text-2xl font-bold text-white mt-1">{digest.metrics.totalProperties}</p>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3.5">
                    <p className="text-[10px] font-mono text-neutral-500 uppercase">Projected MRR</p>
                    <p className="text-2xl font-bold text-cyan-400 mt-1">{digest.metrics.estimatedMrr}</p>
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3.5">
                    <p className="text-[10px] font-mono text-neutral-500 uppercase">Conversion Velocity</p>
                    <p className="text-2xl font-bold text-white mt-1">{digest.metrics.conversionRate}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider mb-2">
                    Email payload preview (delivered to the platform inbox at 08:00 daily)
                  </p>
                  <iframe
                    title="Daily digest email preview"
                    srcDoc={digest.html}
                    className="w-full h-[420px] rounded-xl border border-neutral-800 bg-neutral-950"
                    sandbox=""
                  />
                </div>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ---------------- Outreach kit ---------------- */}
        <TabsContent value="outreach" className="mt-4">
          <SectionCard
            title="🤝 B2B Cold Outreach Framework"
            description="Audit-led, high-ticket conversion methodology targeting commercial property management firms, institutional landlords and infrastructure operators."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(PITCH_TEMPLATE);
                  toast({ title: 'Pitch template copied to clipboard' });
                }}
                className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-cyan-400"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copy Template
              </Button>
            }
          >
            <pre className="whitespace-pre-wrap text-xs font-mono text-neutral-300 leading-relaxed bg-neutral-950 border border-neutral-800 rounded-xl p-5 max-h-[480px] overflow-y-auto rhs-scroll">
              {PITCH_TEMPLATE}
            </pre>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {[
                { title: 'Validate Vendor SLAs', desc: 'Know if landscape contractors hit contract scopes before signing billing logs.' },
                { title: 'Prioritize Deferred Maintenance', desc: 'Catch overgrowth risks and grading shifts before they become fines.' },
                { title: 'One Dashboard Interface', desc: 'A single, date-stamped ledger for field operators and executives.' },
              ].map((card) => (
                <div key={card.title} className="bg-neutral-950 border border-neutral-800 rounded-lg p-4">
                  <p className="text-xs font-bold text-white">{card.title}</p>
                  <p className="text-[11px] text-neutral-400 mt-1.5 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>

      {metrics.isLoading ? null : (
        <p className="text-[10px] font-mono text-neutral-600 text-center">
          <ShieldCheck className="w-3 h-3 inline mr-1 -mt-0.5" />
          Administrative rollups auto-refresh every 20 seconds · tenant boundaries enforced at the API layer
        </p>
      )}
    </div>
  );
}
