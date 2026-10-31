'use client';

import { useState } from 'react';
import { Plus, Receipt, Send, CheckCircle2 } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api, post, patch } from '@/lib/rhs/api';
import type { InvoiceRow, PropertyRow } from '@/lib/rhs/types';
import { moneyExact, shortDate, STATUS_CLASSES } from '@/lib/rhs/format';
import { SectionCard, StatCard, GradientButton, EmptyState } from '../ui-bits';
import { cn } from '@/lib/utils';

export function InvoicesView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [addOpen, setAddOpen] = useState(false);
  const [propertyId, setPropertyId] = useState('none');
  const [amount, setAmount] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api<{ invoices: InvoiceRow[] }>('/invoices'),
  });

  const { data: propertiesData } = useQuery({
    queryKey: ['properties'],
    queryFn: () => api<{ properties: PropertyRow[] }>('/properties'),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    void queryClient.invalidateQueries({ queryKey: ['overview'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
  };

  const createInvoice = useMutation({
    mutationFn: () =>
      post('/invoices', {
        propertyId: propertyId === 'none' ? undefined : propertyId,
        amount: parseFloat(amount),
      }),
    onSuccess: () => {
      invalidate();
      setAddOpen(false);
      setPropertyId('none');
      setAmount('');
      toast({ title: 'Invoice drafted', description: 'Send it to activate the billing cycle.' });
    },
    onError: (err) =>
      toast({
        title: 'Invoice generation failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      }),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patch(`/invoices/${id}`, { status }),
    onSuccess: (_res, vars) => {
      invalidate();
      if (vars.status === 'paid') {
        toast({ title: 'Payment recorded', description: 'Ledger balance updated.' });
      }
    },
  });

  const invoices = data?.invoices ?? [];
  const collected = invoices.filter((i) => i.status === 'paid').reduce((a, i) => a + i.amount, 0);
  const outstanding = invoices.filter((i) => i.status !== 'paid').reduce((a, i) => a + i.amount, 0);
  const properties = propertiesData?.properties ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Collected"
          value={moneyExact(collected)}
          accent="text-emerald-400"
          sub={`${invoices.filter((i) => i.status === 'paid').length} settled invoices`}
          icon={<Receipt className="w-4 h-4" />}
        />
        <StatCard
          label="Outstanding"
          value={moneyExact(outstanding)}
          accent="text-amber-500"
          sub={`${invoices.filter((i) => i.status !== 'paid').length} open invoices`}
          icon={<Send className="w-4 h-4" />}
        />
        <StatCard
          label="Smart Invoicing"
          value={invoices.length}
          sub="Total records in the billing layer"
          icon={<CheckCircle2 className="w-4 h-4" />}
        />
      </div>

      <SectionCard
        title={
          <>
            💳 Trade Workflow &amp; Invoices
            <Receipt className="w-4 h-4 text-emerald-400" />
          </>
        }
        description="Smart invoice generation tied to monitored properties — draft, dispatch and settle from a single ledger."
        action={
          <GradientButton onClick={() => setAddOpen(true)}>
            <span className="flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Create Invoice
            </span>
          </GradientButton>
        }
      >
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-neutral-950 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState>No invoices generated yet — create your first billing record.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-neutral-800 hover:bg-transparent">
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase">Invoice</TableHead>
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase hidden sm:table-cell">
                    Property
                  </TableHead>
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase text-right">Amount</TableHead>
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase hidden md:table-cell">
                    Issued
                  </TableHead>
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase text-center">Status</TableHead>
                  <TableHead className="text-neutral-400 font-mono text-[11px] uppercase text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id} className="border-neutral-800 hover:bg-neutral-950/60">
                    <TableCell className="font-mono text-xs text-white">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-neutral-400 text-xs hidden sm:table-cell">
                      {inv.propertyName ?? '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-emerald-400">
                      {moneyExact(inv.amount)}
                    </TableCell>
                    <TableCell className="text-neutral-500 text-xs font-mono hidden md:table-cell">
                      {shortDate(inv.issuedDate)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-medium border uppercase font-mono',
                          STATUS_CLASSES[inv.status] ?? STATUS_CLASSES.draft,
                        )}
                      >
                        {inv.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {inv.status === 'draft' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: inv.id, status: 'sent' })}
                            className="h-7 px-2.5 text-[11px] border-neutral-700 bg-neutral-900 hover:bg-neutral-800 hover:text-cyan-400"
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Send
                          </Button>
                        ) : null}
                        {inv.status !== 'paid' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: inv.id, status: 'paid' })}
                            className="h-7 px-2.5 text-[11px] border-neutral-700 bg-neutral-900 hover:bg-neutral-800 hover:text-emerald-400"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Mark Paid
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Create invoice dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800">
          <DialogHeader>
            <DialogTitle className="text-white">Generate Smart Invoice</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Billing records tie directly to monitored property work histories.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div>
              <Label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Property (optional)
              </Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger className="w-full bg-neutral-950 border-neutral-800 mt-1 text-sm text-white">
                  <SelectValue placeholder="Link a property" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-900 border-neutral-800">
                  <SelectItem value="none" className="text-sm">
                    No property link
                  </SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-sm">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount" className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Amount (USD)
              </Label>
              <Input
                id="amount"
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="250.00"
                className="bg-neutral-950 border-neutral-800 mt-1 text-sm text-white focus:border-emerald-500"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="text-neutral-400 hover:text-white">
              Cancel
            </Button>
            <GradientButton
              onClick={() => createInvoice.mutate()}
              disabled={createInvoice.isPending || !amount || parseFloat(amount) <= 0}
            >
              {createInvoice.isPending ? 'Generating…' : 'Generate Invoice'}
            </GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
