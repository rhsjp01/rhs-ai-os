'use client';

import dynamic from 'next/dynamic';
import { Radar, Map, Copy, CheckCircle2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { GradientButton, ScoreBar } from './ui-bits';

// ---------------------------------------------------------------------------
// Login gateway — SSR-safe shell.
//
// The interactive auth card (sign-in / register forms + demo workspace
// button) is loaded with `ssr: false` so credential-form markup never lands
// in the server-rendered HTML that crawlers and answer engines fetch. What
// remains crawlable: brand identity, product copy, the sample audit dialog
// trigger and this skeleton. No credential values exist anywhere in the
// client bundle — demo access is minted server-side by POST /api/auth/demo.
// ---------------------------------------------------------------------------
const GatewayAuthCard = dynamic(() => import('./gateway-auth-card').then((m) => m.GatewayAuthCard), {
  ssr: false,
  loading: () => <AuthCardSkeleton />,
});

function AuthCardSkeleton() {
  return (
    <div className="space-y-4 py-2" aria-hidden="true">
      <div className="h-9 rounded-md bg-neutral-950 border border-neutral-800 animate-pulse" />
      <div className="h-11 rounded-md bg-neutral-950 border border-neutral-800 animate-pulse" />
      <div className="h-10 rounded-lg bg-gradient-to-r from-emerald-950 to-cyan-950 border border-neutral-800 animate-pulse" />
      <p className="text-center text-[10px] font-mono text-neutral-600 pt-1">Secure gateway initializing…</p>
    </div>
  );
}

function SampleAuditDialog() {
  const { toast } = useToast();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline underline-offset-4 transition-colors">
          View a sample site audit
        </button>
      </DialogTrigger>
      <DialogContent className="bg-neutral-900 border-neutral-800 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Map className="w-4 h-4 text-cyan-400" />
            Screening-Level Sample Audit
            <span className="ml-auto text-[10px] font-mono text-neutral-500">Ref ID: #DEMO-99</span>
          </DialogTitle>
          <DialogDescription className="text-neutral-400">
            This is the prospect-facing preview referenced in the B2B outreach pitch.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-2 border-dashed border-neutral-800 rounded-xl min-h-[180px] flex flex-col items-center justify-center text-center p-4 bg-neutral-950/40">
            <span className="text-2xl mb-1">🗺️</span>
            <span className="text-xs font-mono text-neutral-400 font-bold">AI Site Visualization Engine</span>
            <span className="text-[10px] text-neutral-600 mt-1">AI-generated aerial imagery · illustrative</span>
            <span className="text-[10px] text-neutral-600 mt-2">📍 Illustrative North Carolina parcel view</span>
          </div>
          <div className="space-y-4">
            <div className="space-y-3">
              <ScoreBar label="Turf Health Ratio" score={78} />
              <ScoreBar label="Drainage Flow Grade" score={54} />
            </div>
            <div className="border border-neutral-800 bg-neutral-950 p-3 rounded-xl text-center">
              <span className="text-sm">🔒</span>
              <h4 className="text-xs font-bold text-white mt-1">Full Compliance Ledger Locked</h4>
              <p className="text-[10px] text-neutral-400 mt-1 mb-2.5">
                1 active right-of-way overgrowth risk marker detected. Unlock the unthrottled dashboard to track
                resolution steps.
              </p>
              <GradientButton
                className="w-full !py-2 !text-xs"
                onClick={() =>
                  toast({
                    title: 'Sample audit CTA',
                    description: 'Prospects would land on the workspace signup from here.',
                  })
                }
              >
                Claim This Workspace Portal
              </GradientButton>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-600">
          <CheckCircle2 className="w-3 h-3" /> Screening audits are complimentary — full audits require an active
          workspace.
          <button
            className="ml-auto flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
            onClick={() => {
              void navigator.clipboard?.writeText('https://rhsaisolutions.com/sample?id=DEMO-99');
              toast({ title: 'Sample link copied' });
            }}
          >
            <Copy className="w-3 h-3" /> Copy link
          </button>
        </div>
        <p className="text-[10px] font-mono text-neutral-600 text-center border-t border-neutral-900 pt-2">
          Sample imagery and scores are AI-generated for demonstration — not satellite, drone or survey data.
        </p>
      </DialogContent>
    </Dialog>
  );
}

export function LoginGateway({ onAuthed }: { onAuthed: () => void }) {
  return (
    <div className="w-full max-w-md">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mb-3">
            <Radar className="w-6 h-6 text-neutral-950" />
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest">
            RHS AI Solutions
          </span>
          <h2 className="text-xl font-black text-white mt-1">Control Center Gateway</h2>
          <p className="text-xs text-neutral-500 mt-1">
            Property Intelligence &amp; Operational Compliance OS
          </p>
        </div>

        <GatewayAuthCard onAuthed={onAuthed} />
      </div>

      <div className="mt-5 text-center">
        <SampleAuditDialog />
      </div>
    </div>
  );
}
