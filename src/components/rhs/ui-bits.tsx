'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import {
  TIER_BADGE_CLASSES,
  TIER_BADGE_LABELS,
  scoreBarColor,
  scoreColor,
} from '@/lib/rhs/format';

export function StatCard({
  label,
  value,
  sub,
  accent = 'text-white',
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'bg-neutral-900 border border-neutral-800 rounded-xl p-5 flex flex-col gap-1',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-neutral-400 text-[11px] font-mono uppercase tracking-wider">
          {label}
        </span>
        {icon ? <span className="text-neutral-600">{icon}</span> : null}
      </div>
      <div className={cn('text-3xl font-bold mt-1 leading-tight', accent)}>{value}</div>
      {sub ? <div className="text-xs text-neutral-500 mt-0.5">{sub}</div> : null}
    </div>
  );
}

export function TierBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border',
        TIER_BADGE_CLASSES[status] ?? TIER_BADGE_CLASSES.free,
        className,
      )}
    >
      {TIER_BADGE_LABELS[status] ?? status}
    </span>
  );
}

export function QuotaMeter({
  used,
  limit,
  freeLabel,
  paidLabel,
}: {
  used: number;
  limit: number | null;
  freeLabel: string;
  paidLabel: string;
}) {
  if (limit === null) {
    return (
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-neutral-400">{paidLabel}</span>
        <span className="text-emerald-400 font-bold">{used} / ∞</span>
      </div>
    );
  }
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const danger = used >= limit;
  const warn = pct >= 70;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-neutral-400">{freeLabel}</span>
        <span className={cn('font-bold', danger ? 'text-red-400' : warn ? 'text-amber-400' : 'text-white')}>
          {used} / {limit}
        </span>
      </div>
      <Progress
        value={pct}
        className="h-1.5 bg-neutral-800 [&>div]:bg-emerald-500"
      />
    </div>
  );
}

export function ScoreBar({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs font-mono text-neutral-400 mb-1">
        <span>{label}</span>
        <span className={cn('font-bold', scoreColor(score))}>
          {score != null ? `${score}/100` : '—'}
        </span>
      </div>
      <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', scoreBarColor(score))}
          style={{ width: score != null ? `${score}%` : '0%' }}
        />
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-neutral-900 border border-neutral-800 rounded-xl p-5 md:p-6', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">{title}</h2>
          {description ? <p className="text-xs text-neutral-400 mt-1 max-w-xl">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="text-center py-10 text-sm font-mono text-neutral-500 bg-neutral-950/60 rounded-xl border border-dashed border-neutral-800">
      {children}
    </div>
  );
}

export function GradientButton({
  children,
  onClick,
  disabled,
  className,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-500',
        'text-neutral-950 font-bold rounded-lg text-sm px-4 py-2.5 transition-all',
        className,
      )}
    >
      {children}
    </button>
  );
}
