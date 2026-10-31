'use client';

import { useState } from 'react';
import { Satellite, ScrollText, Bot, ShieldCheck } from 'lucide-react';
import { useRhsStore as useTourStore } from '@/lib/rhs/store';

interface TourStep {
  title: string;
  description: string;
  icon: React.ElementType;
}

export function OnboardingTour({ isAdmin }: { isAdmin: boolean }) {
  const { tourActive, setTourActive } = useTourStore();
  const [currentStep, setCurrentStep] = useState(0);

  const steps: TourStep[] = [
    {
      title: '🛰️ Site Intelligence Hub',
      description:
        'Your aerial oversight portal. Run automated condition audits, review turf health ratios and drainage grading — each audit generates a fresh AI aerial visualization without manual site visits. Imagery is AI-generated — illustrative, not survey data.',
      icon: Satellite,
    },
    {
      title: '📜 Regulatory Compliance Log',
      description:
        'Track outstanding maintenance liabilities, prioritize deferred tasks, and log date-stamped vegetation or structural issues matching regional compliance laws.',
      icon: ScrollText,
    },
    {
      title: '🤖 Answer Engine Rankings (AEO)',
      description:
        'Monitor how your services display inside AI search engines like Gemini, ChatGPT and Perplexity. Trigger the global crawler to refresh simulated visibility placements — estimates, not live engine queries.',
      icon: Bot,
    },
    ...(isAdmin
      ? [
          {
            title: '🛡️ Administrative Core Control',
            description:
              'Global tenant rollups, automatic conversion alerts, the Zelle manual audit queue and the 8:00 AM daily digest compiler live here.',
            icon: ShieldCheck,
          } satisfies TourStep,
        ]
      : []),
  ];

  if (!tourActive) return null;

  const finish = () => {
    window.localStorage.setItem('rhs_tour_dismissed', '1');
    setTourActive(false);
  };

  const step = steps[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 max-w-sm w-full sm:w-auto bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl">
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-900 px-2 py-0.5 rounded-full uppercase tracking-wider">
          System Walkthrough · Step {currentStep + 1} of {steps.length}
        </span>
        <button
          onClick={finish}
          className="text-neutral-500 hover:text-white transition-colors font-mono text-xs"
          aria-label="Skip tour"
        >
          ✕ Skip
        </button>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center shrink-0">
          <StepIcon className="w-[18px] h-[18px] text-emerald-400" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white tracking-tight">{step.title}</h4>
          <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">{step.description}</p>
        </div>
      </div>

      <div className="flex justify-between items-center pt-3 mt-3 border-t border-neutral-800">
        <div className="flex gap-1">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 rounded-full transition-all ${
                idx === currentStep ? 'w-4 bg-emerald-500' : 'w-1.5 bg-neutral-700'
              }`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          {currentStep > 0 ? (
            <button
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="px-3 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 font-medium text-xs rounded-lg transition-colors border border-neutral-800"
            >
              Back
            </button>
          ) : null}
          <button
            onClick={() => {
              if (currentStep < steps.length - 1) setCurrentStep((prev) => prev + 1);
              else finish();
            }}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-neutral-950 font-bold text-xs rounded-lg transition-all"
          >
            {currentStep === steps.length - 1 ? 'Got it!' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
