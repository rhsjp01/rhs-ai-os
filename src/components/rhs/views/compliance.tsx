'use client';

import { useState } from 'react';
import { Plus, Lock, Calendar, User, ScrollText } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api, post, patch, useMe, ApiError } from '@/lib/rhs/api';
import type { ComplianceRow, PropertyRow } from '@/lib/rhs/types';
import { useRhsStore } from '@/lib/rhs/store';
import { relativeTime, shortDate, SEVERITY_CLASSES, STATUS_CLASSES } from '@/lib/rhs/format';
import { SectionCard, GradientButton, EmptyState } from '../ui-bits';
import { cn } from '@/lib/utils';

const LOG_TYPES = [
  'Vegetation Overgrowth',
  'Drainage Issue',
  'Routine Audit',
  'Erosion Damage',
  'Right-of-Way Violation',
  'Structural Concern',
];

const SEVERITIES = ['low', 'medium', 'high', 'critical'];

export function ComplianceView() {
  const me = useMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const setUpgrade = useRhsStore((s) => s.setUpgrade);
  const setView = useRhsStore((s) => s.setView);

  const [addOpen, setAddOpen] = useState(false);
  const [propertyId, setPropertyId] = useState('');
  const [logType, setLogType] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const isFreeTier = ['free', 'past_due', 'pending_zelle_audit'].includes(me.data?.tier.key ?? 'free');

  const { data, isLoading } = useQuery({
    queryKey: ['compliance'],
    queryFn: () => api<{ logs: ComplianceRow[] }>('/compliance'),
  });

  const { data: propertiesData } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api<{ properties: PropertyRow[] }>('/properties'),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['compliance'] });
    void queryClient.invalidateQueries({ queryKey: ['overview'] });
    void queryClient.invalidateQueries({ queryKey: ['properties'] });
  };

  const createLog = useMutation({
    mutationFn: () =>
      post('/compliance', {
        propertyId,
        logType,
        severity,
        description,
        dueDate: dueDate || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      setPropertyId('');
      setLogType('');
      setDescription('');
      setDueDate('');
      toast({ title: 'Compliance issue logged', description: 'The ledger entry is now tracked.' });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'COMPLIANCE_READ_ONLY') {
        setUpgrade({ title: 'Read-Only on Free Tier', message: err.message });
      } else {
        toast({
          title: 'Could not log issue',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patch(`/compliance/${id}`, { resolutionStatus: status }),
    onSuccess: (_res, vars) => {
      invalidate();
      if (vars.status === 'resolved') toast({ title: 'Issue resolved', description: 'Liability cleared from the ledger.' });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'COMPLIANCE_READ_ONLY') {
        setUpgrade({ title: 'Read-Only on Free Tier', message: err.message });
      }
    },
  });

  const logs = data?.logs ?? [];
  const properties = (propertiesData?.properties ?? []).filter(
    (p) => !me.data?.isAdmin || true,
  );

  return (
    <div className="space-y-6">
      {isFreeTier ? (
        <div className="bg-amber-950/30 border border-amber-900/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-400">Compliance ledger is view-only on the Free tier</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                Full read/write logging, resolution workflows and PDF export unlock with Professional.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => setView('billing')}
            className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold"
          >
            Unlock Pro
          </Button>
        </div>
      ) : null}

      <SectionCard
        title={
          <>
            📜 Active Regulatory Compliance Log
            <ScrollText className="w-4 h-4 text-emerald-400" />
          </>
        }
        description="Date-stamped condition logging with severity triage, resolution tracking and regional vegetation compliance support."
        action={
          <GradientButton onClick={() => setAddOpen(true)} disabled={isFreeTier}>
            <span className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Log New Issue
            </span>
          </GradientButton>
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-neutral-950 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <EmptyState>No compliance entries — your portfolio is clean.</EmptyState>
        ) : (
          <div className="space-y-3 max-h-[560px] overflow-y-auto rhs-scroll pr-1">
            {logs.map((log) => (
              <div
                key={log.id}
                className="bg-neutral-950 border border-neutral-800 p-4 rounded-lg flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-white">{log.logType}</p>
                    {log.severity ? (
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 font-mono rounded border uppercase',
                          SEVERITY_CLASSES[log.severity] ?? SEVERITY_CLASSES.low,
                        )}
                      >
                        {log.severity} severity
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 font-mono rounded border uppercase',
                        STATUS_CLASSES[log.resolutionStatus] ?? STATUS_CLASSES.pending,
                      )}
                    >
                      {log.resolutionStatus}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1 font-mono">
                    {log.propertyName}
                    {log.companyName && log.companyName !== log.propertyName ? ` · ${log.companyName}` : ''}
                  </p>
                  {log.description ? (
                    <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed max-w-2xl">
                      {log.description}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] font-mono text-neutral-600">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {log.loggedByName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {log.dueDate ? `due ${shortDate(log.dueDate)}` : 'no due date'}
                    </span>
                    <span>filed {relativeTime(log.createdAt)}</span>
                  </div>
                </div>
                {!isFreeTier ? (
                  <div className="shrink-0">
                    <Select
                      value={log.resolutionStatus}
                      onValueChange={(value) => updateStatus.mutate({ id: log.id, status: value })}
                    >
                      <SelectTrigger className="w-36 h-8 bg-neutral-900 border-neutral-800 text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-900 border-neutral-800">
                        <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                        <SelectItem value="scheduled" className="text-xs">Scheduled</SelectItem>
                        <SelectItem value="resolved" className="text-xs">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Log new issue dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle className="text-white">Log Compliance Issue</DialogTitle>
            <DialogDescription className="text-neutral-400">
              File a date-stamped liability against a monitored property.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div>
              <Label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">Property</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger className="w-full bg-neutral-950 border-neutral-800 mt-1 text-sm text-white">
                  <SelectValue placeholder="Select a monitored property" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-800">
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">Log Type</Label>
                <Select value={logType} onValueChange={setLogType}>
                  <SelectTrigger className="w-full bg-neutral-950 border-neutral-800 mt-1 text-sm text-white">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800">
                    {LOG_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-sm">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">Severity</Label>
                <Select value={severity} onValueChange={setSeverity}>
                  <SelectTrigger className="w-full bg-neutral-950 border-neutral-800 mt-1 text-sm text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800">
                    {SEVERITIES.map((s) => (
                      <SelectItem key={s} value={s} className="text-sm capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="due-date" className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Due Date (optional)
              </Label>
              <Input
                id="due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-neutral-950 border-neutral-800 mt-1 text-sm text-white focus:border-emerald-500"
              />
            </div>
            <div>
              <Label htmlFor="desc" className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Description
              </Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Unmanaged growth violating right-of-way easement near track boundary markers…"
                className="bg-neutral-950 border-neutral-800 mt-1 text-sm text-white focus:border-emerald-500 min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="text-neutral-400 hover:text-white">
              Cancel
            </Button>
            <GradientButton
              onClick={() => createLog.mutate()}
              disabled={createLog.isPending || !propertyId || !logType}
            >
              {createLog.isPending ? 'Filing…' : 'File Ledger Entry'}
            </GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
