'use client';

import { Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRhsStore } from '@/lib/rhs/store';
import type { UpgradePrompt } from '@/lib/rhs/store';
import { GradientButton } from './ui-bits';

export function UpgradeModal({ prompt }: { prompt: UpgradePrompt | null }) {
  const { setUpgrade, setView } = useRhsStore();

  return (
    <Dialog open={prompt !== null} onOpenChange={(open) => !open && setUpgrade(null)}>
      <DialogContent className="bg-neutral-950 border-neutral-800 max-w-md">
        <DialogHeader>
          <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto mb-2">
            <Zap className="w-6 h-6 text-amber-400" />
          </div>
          <DialogTitle className="text-center text-xl font-extrabold text-white">
            {prompt?.title ?? 'Upgrade to Pro Tier Required'}
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-neutral-400 mt-2 leading-relaxed">
            {prompt?.message ??
              'You have exhausted your free evaluation tokens. Upgrade to unlock 50 property audits per month, AEO visibility tracking, and the full compliance ledger.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-2">
          <GradientButton
            className="w-full !py-3"
            onClick={() => {
              setUpgrade(null);
              setView('billing');
            }}
          >
            Unlock Professional Access ($149/mo)
          </GradientButton>
          <button
            onClick={() => setUpgrade(null)}
            className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white font-medium text-sm rounded-xl transition-colors border border-neutral-800"
          >
            Return to Workspace
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
