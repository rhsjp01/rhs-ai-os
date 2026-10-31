'use client';

import { useState } from 'react';
import {
  Plus,
  Radar,
  Trash2,
  Eye,
  MapPin,
  Satellite,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api, post, del, useMe, ApiError } from '@/lib/rhs/api';
import type { PropertyRow } from '@/lib/rhs/types';
import { useRhsStore } from '@/lib/rhs/store';
import { relativeTime, scoreColor } from '@/lib/rhs/format';
import { SectionCard, QuotaMeter, GradientButton, EmptyState, ScoreBar } from '../ui-bits';
import { cn } from '@/lib/utils';

interface PropertyForm {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
}

const EMPTY_FORM: PropertyForm = { name: '', address: '', latitude: '', longitude: '' };

export function PropertiesView() {
  const me = useMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const setUpgrade = useRhsStore((s) => s.setUpgrade);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<PropertyForm>(EMPTY_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PropertyRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api<{ properties: PropertyRow[] }>('/properties'),
  });

  // The detail dialog derives from the live query cache (not a stale row
  // snapshot) so freshly generated audits, scores and imagery appear
  // immediately after a re-run.
  const detail = data?.properties.find((p) => p.id === detailId) ?? null;

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['properties'] });
    void queryClient.invalidateQueries({ queryKey: ['overview'] });
    void queryClient.invalidateQueries({ queryKey: ['me'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
  };

  const addProperty = useMutation({
    mutationFn: () =>
      post<{ autoPromoted: boolean }>('/properties', {
        name: form.name,
        address: form.address || undefined,
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
      }),
    onSuccess: (res) => {
      invalidate();
      setAddOpen(false);
      setForm(EMPTY_FORM);
      if (res.autoPromoted) {
        toast({
          title: '🚀 Automatic tier promotion!',
          description:
            '5-property milestone reached — your workspace auto-upgraded to Professional (Pro Unlocked) with 50 monthly audit capacity.',
        });
      } else {
        toast({ title: 'Property registered', description: 'Run an AI site audit to generate its scorecard.' });
      }
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'QUOTA_EXCEEDED') {
        setUpgrade({ title: 'Upgrade to Pro Tier Required', message: err.message });
      } else {
        toast({
          title: 'Property registration failed',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    },
  });

  const runAudit = useMutation({
    mutationFn: (id: string) => post<{ satelliteGenerated: boolean }>(`/properties/${id}/audit`),
    onMutate: (id) => setBusyId(id),
    onSuccess: (res) => {
      invalidate();
      toast({
        title: 'AI site audit complete',
        description: res.satelliteGenerated
          ? 'Condition scores refreshed and AI visualization rendered.'
          : 'Condition scores refreshed (imagery engine busy — scores still updated).',
      });
    },
    onError: (err) =>
      toast({
        title: 'Audit pipeline failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      }),
    onSettled: () => setBusyId(null),
  });

  const removeProperty = useMutation({
    mutationFn: (id: string) => del(`/properties/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast({ title: 'Property removed from ledger' });
    },
  });

  const properties = data?.properties ?? [];
  const quota = me.data?.quota;
  const isFreeTier = ['free', 'past_due', 'pending_zelle_audit'].includes(me.data?.tier.key ?? 'free');

  const statusFor = (p: PropertyRow): { label: string; compliant: boolean } => {
    if (p.turfConditionScore == null || p.drainageScore == null) {
      return { label: 'Awaiting Audit', compliant: false };
    }
    const compliant = p.turfConditionScore >= 70 && p.drainageScore >= 65;
    return { label: compliant ? 'Compliant' : 'Action Required', compliant };
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title={
          <>
            🛰️ Site Intelligence Hub
            <Radar className="w-4 h-4 text-emerald-400" />
          </>
        }
        description="Aerial-style oversight portal — run automated condition audits, review turf and drainage grading, and generate AI aerial visualizations without manual site visits. Imagery is AI-generated — illustrative, not survey data."
        action={
          <GradientButton onClick={() => setAddOpen(true)}>
            <span className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {isFreeTier ? 'Analyze New Property' : 'Add Property'}
            </span>
          </GradientButton>
        }
      >
        {quota ? (
          <div className="mb-4 bg-neutral-950 border border-neutral-800 rounded-lg p-3.5">
            <QuotaMeter
              used={quota.propertyCount}
              limit={quota.propertyLimit}
              freeLabel="Free site intel tokens consumed"
              paidLabel="Properties under management"
            />
            {isFreeTier ? (
              <p className="text-[10px] font-mono text-neutral-600 mt-2">
                Reaching 5 properties auto-unlocks the Professional tier — the system tracks usage and promotes
                heavy users automatically.
              </p>
            ) : null}
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-neutral-950 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <EmptyState>
            No monitored assets yet — register your first property to activate site intelligence.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-neutral-800 hover:bg-transparent">
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase">Property</TableHead>
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase hidden sm:table-cell">
                    Location
                  </TableHead>
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase text-center">Turf</TableHead>
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase text-center hidden sm:table-cell">
                    Drainage
                  </TableHead>
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase hidden md:table-cell">
                    Last Analyzed
                  </TableHead>
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase text-center hidden lg:table-cell">
                    Open Issues
                  </TableHead>
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase text-right">Status</TableHead>
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((p) => {
                  const status = statusFor(p);
                  const busy = busyId === p.id;
                  return (
                    <TableRow
                      key={p.id}
                      className="border-neutral-800 hover:bg-neutral-950/60"
                    >
                      <TableCell className="font-medium text-white text-sm">{p.name}</TableCell>
                      <TableCell className="text-neutral-400 text-xs hidden sm:table-cell">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-neutral-600" />
                          {p.address ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className={cn('text-center font-mono text-sm', scoreColor(p.turfConditionScore))}>
                        {p.turfConditionScore != null ? `${p.turfConditionScore}%` : '—'}
                      </TableCell>
                      <TableCell className={cn('text-center font-mono text-sm hidden sm:table-cell', scoreColor(p.drainageScore))}>
                        {p.drainageScore != null ? `${p.drainageScore}%` : '—'}
                      </TableCell>
                      <TableCell className="text-neutral-500 text-xs font-mono hidden md:table-cell">
                        {p.satelliteLastAnalyzed ? relativeTime(p.satelliteLastAnalyzed) : 'never'}
                      </TableCell>
                      <TableCell className="text-center hidden lg:table-cell">
                        {p.openComplianceCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-mono text-xs">
                            <AlertTriangle className="w-3 h-3" />
                            {p.openComplianceCount}
                          </span>
                        ) : (
                          <span className="text-neutral-600 font-mono text-xs">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap',
                            status.compliant
                              ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border-amber-800',
                          )}
                        >
                          {status.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => runAudit.mutate(p.id)}
                            className="h-7 px-2.5 text-[11px] border-neutral-700 bg-neutral-900 hover:bg-neutral-800 hover:text-emerald-400"
                          >
                            {busy ? (
                              <>
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                Analyzing…
                              </>
                            ) : (
                              <>
                                <Satellite className="w-3 h-3 mr-1" />
                                Audit
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDetailId(p.id)}
                            className="h-7 w-7 p-0 text-neutral-400 hover:text-white"
                            aria-label={`View ${p.name}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget(p)}
                            className="h-7 w-7 p-0 text-neutral-500 hover:text-red-400"
                            aria-label={`Delete ${p.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Add property dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle className="text-white">Asset Evaluator Engine</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Register a new site for geospatial condition and drainage auditing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div>
              <Label htmlFor="prop-name" className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Property Name
              </Label>
              <Input
                id="prop-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Sandhills Rail Terminal"
                className="bg-neutral-950 border-neutral-800 mt-1 text-sm text-white focus:border-emerald-500"
              />
            </div>
            <div>
              <Label htmlFor="prop-address" className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Address
              </Label>
              <Input
                id="prop-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Aberdeen, NC"
                className="bg-neutral-950 border-neutral-800 mt-1 text-sm text-white focus:border-emerald-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prop-lat" className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                  Latitude (optional)
                </Label>
                <Input
                  id="prop-lat"
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                  placeholder="35.1315"
                  className="bg-neutral-950 border-neutral-800 mt-1 text-sm text-white focus:border-emerald-500"
                />
              </div>
              <div>
                <Label htmlFor="prop-lng" className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                  Longitude (optional)
                </Label>
                <Input
                  id="prop-lng"
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                  placeholder="-79.4295"
                  className="bg-neutral-950 border-neutral-800 mt-1 text-sm text-white focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setAddOpen(false)}
              className="text-neutral-400 hover:text-white"
            >
              Cancel
            </Button>
            <GradientButton
              onClick={() => addProperty.mutate()}
              disabled={addProperty.isPending || !form.name.trim()}
            >
              {addProperty.isPending ? 'Registering…' : '➕ Register & Track'}
            </GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="bg-neutral-900 border-neutral-800 max-w-2xl">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <Satellite className="w-4 h-4 text-emerald-400" />
                  {detail.name}
                  <span className="ml-auto text-[10px] font-mono text-neutral-500">
                    {detail.address ?? 'Location pending'}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-neutral-400">
                  Site intelligence dossier — last analyzed{' '}
                  {detail.satelliteLastAnalyzed ? relativeTime(detail.satelliteLastAnalyzed) : 'never'}. Scores and
                  imagery are simulated for demonstration.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 min-h-[180px] flex items-center justify-center relative">
                  {detail.satelliteImageUrl ? (
                    <img
                      src={`/api/satellite/${detail.id}`}
                      alt={`AI-generated aerial visualization of ${detail.name}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-6">
                      <span className="text-3xl block mb-2">🛰️</span>
                      <span className="text-xs font-mono text-neutral-400 font-bold">
                        No visualization rendered
                      </span>
                      <span className="text-[10px] text-neutral-600 mt-1 block">
                        Run an AI site audit to generate imagery
                      </span>
                    </div>
                  )}
                  {detail.satelliteImageUrl ? (
                    <span className="absolute bottom-0 inset-x-0 bg-neutral-950/80 text-[9px] font-mono text-neutral-400 text-center py-1 px-2">
                      AI-generated visualization — illustrative, not satellite or survey data
                    </span>
                  ) : null}
                  {busyId === detail.id ? (
                    <div className="absolute inset-0 bg-neutral-950/80 flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                      <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                        Generating AI visualization…
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="space-y-5">
                  <div className="space-y-3">
                    <ScoreBar label="Turf Health Ratio" score={detail.turfConditionScore} />
                    <ScoreBar label="Drainage Flow Grade" score={detail.drainageScore} />
                  </div>
                  <div className="text-xs font-mono text-neutral-500 space-y-1.5 bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                    {detail.latitude != null && detail.longitude != null ? (
                      <p>
                        📍 Coordinates: {detail.latitude.toFixed(4)}, {detail.longitude.toFixed(4)}
                      </p>
                    ) : (
                      <p>📍 Coordinates pending verification</p>
                    )}
                    <p>🏢 Tenant: {detail.companyName}</p>
                    <p>🗓️ Registered: {relativeTime(detail.createdAt)}</p>
                  </div>
                  <GradientButton
                    className="w-full"
                    disabled={busyId === detail.id}
                    onClick={() => runAudit.mutate(detail.id)}
                  >
                    {busyId === detail.id ? 'Running audit…' : 'Re-run AI Site Audit'}
                  </GradientButton>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-neutral-900 border-neutral-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remove property from ledger?</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              {deleteTarget?.name} and its compliance history will be permanently removed. Auto-unlocked
              workspaces falling below 5 properties revert to the Free tier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white">
              Keep Property
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && removeProperty.mutate(deleteTarget.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
