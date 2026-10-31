'use client';

import { formatDistanceToNow, format } from 'date-fns';

export function money(n: number, opts?: { decimals?: number }): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: opts?.decimals ?? 0,
    maximumFractionDigits: opts?.decimals ?? 0,
  });
}

export function moneyExact(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

export function shortDate(iso: string): string {
  try {
    return format(new Date(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}

export function scoreColor(score: number | null): string {
  if (score == null) return 'text-neutral-500';
  if (score >= 75) return 'text-emerald-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

export function scoreBarColor(score: number | null): string {
  if (score == null) return 'bg-neutral-700';
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

export const TIER_BADGE_CLASSES: Record<string, string> = {
  free: 'bg-neutral-800/80 text-neutral-300 border-neutral-700',
  active: 'bg-emerald-950/80 text-emerald-400 border-emerald-800',
  pro_unlocked: 'bg-emerald-950/80 text-emerald-400 border-emerald-800',
  enterprise_unlocked: 'bg-cyan-950/80 text-cyan-400 border-cyan-800',
  past_due: 'bg-red-950/80 text-red-400 border-red-800',
  pending_zelle_audit: 'bg-violet-950/80 text-violet-400 border-violet-800',
};

export const TIER_BADGE_LABELS: Record<string, string> = {
  free: 'FREE',
  active: 'PRO',
  pro_unlocked: 'PRO+',
  enterprise_unlocked: 'ENTERPRISE',
  past_due: 'PAST DUE',
  pending_zelle_audit: 'ZELLE',
};

export const SEVERITY_CLASSES: Record<string, string> = {
  low: 'text-neutral-300 bg-neutral-800/60 border-neutral-700',
  medium: 'text-amber-400 bg-amber-950/40 border-amber-800/60',
  high: 'text-red-400 bg-red-950/40 border-red-800/60',
  critical: 'text-red-300 bg-red-950/70 border-red-700',
};

export const STATUS_CLASSES: Record<string, string> = {
  pending: 'text-amber-400 border-amber-900 bg-amber-950',
  scheduled: 'text-cyan-400 border-cyan-900 bg-cyan-950',
  resolved: 'text-emerald-400 border-emerald-900 bg-emerald-950',
  draft: 'text-neutral-300 border-neutral-700 bg-neutral-800/60',
  sent: 'text-cyan-400 border-cyan-900 bg-cyan-950',
  paid: 'text-emerald-400 border-emerald-900 bg-emerald-950',
  overdue: 'text-red-400 border-red-900 bg-red-950',
};
