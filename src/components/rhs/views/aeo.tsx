'use client';

import { useState } from 'react';
import { Bot, Plus, RefreshCw, Loader2, Globe } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { api, post, useMe, ApiError } from '@/lib/rhs/api';
import type { AeoRecordRow } from '@/lib/rhs/types';
import { useRhsStore } from '@/lib/rhs/store';
import { relativeTime } from '@/lib/rhs/format';
import { SectionCard, GradientButton, EmptyState, QuotaMeter } from '../ui-bits';
import { cn } from '@/lib/utils';

interface SyncResult {
  crawled: number;
  updatedRecords: number;
  avgRank: number | null;
  sourceBreakdown: { llm: number; fallback: number };
}

export function AeoView() {
  const me = useMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const setUpgrade = useRhsStore((s) => s.setUpgrade);
  const [keyword, setKeyword] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['aeo'],
    queryFn: () => api<{ records: AeoRecordRow[] }>('/aeo'),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['aeo'] });
    void queryClient.invalidateQueries({ queryKey: ['overview'] });
  };

  const addKeyword = useMutation({
    mutationFn: () => post('/aeo', { keyword }),
    onSuccess: () => {
      invalidate();
      setKeyword('');
      toast({
        title: 'Keyword tracked',
        description: 'Trigger the global crawler to benchmark your visibility placement.',
      });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.code === 'KEYWORD_LIMIT') {
        setUpgrade({ title: 'Keyword Limit Reached', message: err.message });
      } else {
        toast({
          title: 'Could not add keyword',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    },
  });

  const sync = useMutation({
    mutationFn: () => post<SyncResult>('/aeo/sync'),
    onSuccess: (res) => {
      invalidate();
      toast({
        title: `Crawler sync finished — ${res.crawled} engine crawls`,
        description: `Average visibility placement: ${res.avgRank ? `#${res.avgRank}` : 'brand not cited'}. ${res.updatedRecords} records refreshed.`,
      });
    },
    onError: (err) =>
      toast({
        title: 'Crawler sync failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      }),
  });

  const records = data?.records ?? [];
  const quota = me.data?.quota;

  // Group records by keyword
  const grouped = new Map<string, AeoRecordRow[]>();
  for (const r of records) {
    const list = grouped.get(r.keyword) ?? [];
    list.push(r);
    grouped.set(r.keyword, list);
  }

  const rankBadge = (rank: number | null) => {
    if (rank == null) {
      return <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">NOT CITED</span>;
    }
    if (rank <= 3) {
      return <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">POS #{rank}</span>;
    }
    return <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">POS #{rank}</span>;
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title={
          <>
            🤖 Answer Engine Rankings (AEO)
            <Bot className="w-4 h-4 text-cyan-400" />
          </>
        }
        description="Monitor how your services display inside AI search engines (Gemini, ChatGPT, Perplexity). The crawler simulates engine answers with an LLM, parses the recommendation lists and logs your visibility placement — ranks are simulated estimates, not live engine queries."
        action={
          <GradientButton onClick={() => sync.mutate()} disabled={sync.isPending || records.length === 0}>
            <span className="flex items-center gap-1.5">
              {sync.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {sync.isPending ? 'Crawling AI Engines…' : 'Trigger Global AI Crawler Sync'}
            </span>
          </GradientButton>
        }
      >
        {sync.isPending ? (
          <div className="mb-4 bg-neutral-950 border border-cyan-900/50 rounded-lg p-3.5 flex items-center gap-3">
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
            <div className="text-xs font-mono text-cyan-300">
              <span className="text-cyan-400 font-bold">CRAWLER ACTIVE</span>
              <span className="text-neutral-500"> · dispatching queries to </span>
              Gemini AI, ChatGPT &amp; Perplexity
              <span className="text-neutral-500"> · parsing recommendation lists for brand citation…</span>
            </div>
          </div>
        ) : null}

        <p className="mb-4 text-[10px] font-mono text-neutral-500 bg-neutral-950 border border-neutral-800 rounded-lg px-3.5 py-2.5">
          <span className="text-cyan-400 font-bold">SIMULATION NOTICE</span> — ranks and snippets are generated by
          an LLM simulation of answer-engine responses, not live engine queries. Treat them as directional
          estimates.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex-1 relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && keyword.trim().length >= 3) addKeyword.mutate();
              }}
              placeholder="commercial landscaping near me"
              className="bg-neutral-950 border-neutral-800 pl-9 text-sm text-white focus:border-emerald-500"
            />
          </div>
          <Button
            onClick={() => addKeyword.mutate()}
            disabled={addKeyword.isPending || keyword.trim().length < 3}
            variant="outline"
            className="border-neutral-700 bg-neutral-900 hover:bg-neutral-800 hover:text-emerald-400"
          >
            <span className="flex items-center gap-1.5 text-sm">
              {addKeyword.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Track Keyword
            </span>
          </Button>
        </div>

        {quota ? (
          <div className="mb-4 bg-neutral-950 border border-neutral-800 rounded-lg p-3.5">
            <QuotaMeter
              used={quota.keywordCount}
              limit={quota.keywordLimit}
              freeLabel="Free tier keyword tracking"
              paidLabel="Keywords under automated tracking"
            />
            <p className="text-[10px] font-mono text-neutral-600 mt-2">
              Free: 1 keyword (manual trigger) · Professional: 10 keywords (daily auto-sync) · Enterprise:
              unlimited real-time.
            </p>
          </div>
        ) : null}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-neutral-950 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : grouped.size === 0 ? (
          <EmptyState>
            No keywords tracked yet — add your first local search term above, then trigger the crawler.
          </EmptyState>
        ) : (
          <div className="space-y-5 max-h-[600px] overflow-y-auto rhs-scroll pr-1">
            {Array.from(grouped.entries()).map(([kw, engineRecords]) => {
              const cited = engineRecords.filter((r) => r.searchVisibilityRank != null);
              const avg =
                cited.length > 0
                  ? Math.round((cited.reduce((a, r) => a + (r.searchVisibilityRank ?? 0), 0) / cited.length) * 10) / 10
                  : null;
              return (
                <div key={kw} className="space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-sm font-medium text-white">&quot;{kw}&quot;</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-neutral-500 uppercase">
                        {engineRecords.length} engines
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                          avg && avg <= 3
                            ? 'text-emerald-400 border-emerald-900 bg-emerald-950'
                            : 'text-cyan-400 border-cyan-900 bg-cyan-950',
                        )}
                      >
                        {avg ? `AVG #${avg} · ${avg <= 3 ? 'OPTIMAL' : 'TRACKING'}` : 'NOT CITED'}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    {engineRecords.map((r) => (
                      <div key={r.id} className="bg-neutral-950 p-3.5 border border-neutral-800 rounded-lg space-y-2.5">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                            {r.engineName}
                          </span>
                          {rankBadge(r.searchVisibilityRank)}
                        </div>
                        <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-4">
                          {r.aiRecommendationSnippet ?? 'No engine snapshot logged yet — run a crawler sync.'}
                        </p>
                        <p className="text-[10px] font-mono text-neutral-600 pt-1 border-t border-neutral-900">
                          crawled {relativeTime(r.lastCrawledAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
