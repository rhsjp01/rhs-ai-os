'use client';

import { useEffect } from 'react';
import {
  LayoutDashboard,
  Satellite,
  ScrollText,
  Receipt,
  Bot,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  LogOut,
  RotateCcw,
  ChevronDown,
  Radar,
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { post, useMe, useHasSessionToken, clearSessionToken } from '@/lib/rhs/api';
import { useRhsStore, ViewKey } from '@/lib/rhs/store';
import { cn } from '@/lib/utils';
import { LoginGateway } from './login-gateway';
import { OnboardingTour } from './onboarding-tour';
import { UpgradeModal } from './upgrade-modal';
import { TierBadge } from './ui-bits';
import { OverviewView } from './views/overview';
import { PropertiesView } from './views/properties';
import { ComplianceView } from './views/compliance';
import { InvoicesView } from './views/invoices';
import { AeoView } from './views/aeo';
import { BillingView } from './views/billing';
import { AdminView } from './views/admin';
import { WealthView } from './views/wealth';

const NAV_ITEMS: Array<{ key: ViewKey; label: string; icon: React.ElementType; adminOnly?: boolean }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'properties', label: 'Site Intel', icon: Satellite },
  { key: 'compliance', label: 'Compliance', icon: ScrollText },
  { key: 'invoices', label: 'Invoicing', icon: Receipt },
  { key: 'aeo', label: 'AEO Tracker', icon: Bot },
  { key: 'billing', label: 'Billing', icon: CreditCard },
  { key: 'wealth', label: 'Wealth', icon: TrendingUp },
  { key: 'admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
];

function BootScreen() {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center gap-4 text-neutral-100">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
        <Radar className="w-7 h-7 text-neutral-950 animate-pulse" />
      </div>
      <div className="text-center">
        <p className="font-mono text-sm text-emerald-400 font-bold uppercase tracking-widest">
          Initializing System Core
        </p>
        <p className="text-xs text-neutral-500 mt-1 font-mono">RHS AI Solutions OS · boot sequence…</p>
      </div>
    </div>
  );
}

export function RhsShell() {
  const me = useMe();
  const hasStoredSession = useHasSessionToken();
  const { view, setView, tourActive, setTourActive, upgrade } = useRhsStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const logout = useMutation({
    mutationFn: () => post('/auth/logout'),
    onSuccess: () => {
      clearSessionToken();
      queryClient.clear();
      window.location.reload();
    },
  });

  // Launch onboarding tour on first authenticated session
  useEffect(() => {
    if (me.data?.user && !tourActive) {
      const dismissed = window.localStorage.getItem('rhs_tour_dismissed');
      if (!dismissed) setTourActive(true);
    }
  }, [me.data?.user, tourActive, setTourActive]);

  // Boot screen only for returning users restoring a stored session. On the
  // server (and for crawlers / answer engines) the login gateway renders
  // directly, so the initial HTML carries real product content instead of a
  // bare loading state.
  if (me.isLoading && hasStoredSession) return <BootScreen />;

  if (!me.data?.user) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
        <main className="flex-1 flex items-center justify-center p-4 py-10">
          <LoginGateway
            onAuthed={() => {
              me.refetch();
              toast({ title: 'Gateway authenticated', description: 'Welcome to the control center.' });
            }}
          />
        </main>
        <footer className="mt-auto border-t border-neutral-900 py-4 px-6 text-center text-[11px] font-mono text-neutral-600 pb-[env(safe-area-inset-bottom)]">
          RHS AI SOLUTIONS OS — Property Intelligence &amp; Operational Compliance · RHS AI Solutions is a business
          name of Right Hand Services by JP · Candor, NC
        </footer>
      </div>
    );
  }

  const session = me.data;
  const navItems = NAV_ITEMS.filter((item) => !item.adminOnly || session.isAdmin);

  const renderView = () => {
    switch (view) {
      case 'properties':
        return <PropertiesView />;
      case 'compliance':
        return <ComplianceView />;
      case 'invoices':
        return <InvoicesView />;
      case 'aeo':
        return <AeoView />;
      case 'billing':
        return <BillingView />;
      case 'admin':
        return session.isAdmin ? <AdminView /> : null;
      case 'wealth':
        return <WealthView />;
      default:
        return <OverviewView />;
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-950/95 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          <button
            className="flex items-center gap-3 text-left"
            onClick={() => setView('overview')}
            aria-label="RHS AI Solutions OS home"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shrink-0">
              <Radar className="w-5 h-5 text-neutral-950" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base md:text-lg font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                RHS AI Solutions OS
              </h1>
              <p className="hidden sm:block text-[10px] md:text-[11px] text-neutral-500 font-mono uppercase tracking-wider">
                Property Intelligence · Compliance · AEO
              </p>
            </div>
          </button>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-[11px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              System Core Pipeline: Operational
            </div>
            <TierBadge status={session.tier.key} className="hidden sm:inline-flex" />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 transition-colors text-sm">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center text-[10px] font-mono font-bold text-emerald-400 uppercase">
                  {(session.user.fullName ?? session.user.email).slice(0, 2)}
                </div>
                <span className="hidden sm:inline text-xs font-medium text-neutral-300 max-w-[140px] truncate">
                  {session.user.fullName ?? session.user.email}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-500" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-neutral-900 border-neutral-800">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-semibold text-white">{session.user.fullName ?? 'Operator'}</p>
                  <p className="text-xs text-neutral-500">{session.user.email}</p>
                  <p className="mt-1.5 flex items-center gap-2">
                    <TierBadge status={session.tier.key} />
                    <span className="text-[10px] font-mono text-neutral-500 uppercase">
                      {session.user.role}
                    </span>
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-neutral-800" />
                <DropdownMenuItem
                  onClick={() => {
                    window.localStorage.removeItem('rhs_tour_dismissed');
                    setTourActive(true);
                    toast({ title: 'System walkthrough relaunched' });
                  }}
                  className="text-neutral-300"
                >
                  <RotateCcw className="w-4 h-4 mr-2" /> Relaunch walkthrough
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => logout.mutate()}
                  className="text-red-400 focus:text-red-300"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Terminate session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Navigation — scrollable strip on mobile */}
        <nav
          className="border-t border-neutral-900"
          role="navigation"
          aria-label="Primary modules"
        >
          <div className="max-w-7xl mx-auto px-2 md:px-6 flex gap-1 overflow-x-auto no-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                    active
                      ? 'border-emerald-400 text-emerald-400'
                      : 'border-transparent text-neutral-400 hover:text-neutral-200',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main workspace */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {renderView()}
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-neutral-800 bg-neutral-950">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-mono text-neutral-600 pb-[env(safe-area-inset-bottom)]">
          <span>
            RHS AI SOLUTIONS OS · {session.user.company?.name ?? 'Workspace'} · RHS AI Solutions is a business name
            of Right Hand Services by JP · Candor, NC
          </span>
          <span>AI recommends. Human review decides. · © {new Date().getFullYear()}</span>
        </div>
      </footer>

      <OnboardingTour isAdmin={session.isAdmin} />
      <UpgradeModal prompt={upgrade} />
    </div>
  );
}
