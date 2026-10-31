'use client';

import { useState } from 'react';
import { TrendingUp, PiggyBank, Target, Info } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMe } from '@/lib/rhs/api';
import { money } from '@/lib/rhs/format';
import { SectionCard, StatCard } from '../ui-bits';

function compound(
  initial: number,
  monthly: number,
  annualRate: number,
  years: number,
): Array<{ year: number; contributions: number; value: number }> {
  const monthlyRate = annualRate / 100 / 12;
  const rows: Array<{ year: number; contributions: number; value: number }> = [];
  let value = initial;
  let contributions = initial;
  rows.push({ year: 0, contributions, value });
  for (let month = 1; month <= years * 12; month++) {
    value = value * (1 + monthlyRate) + monthly;
    contributions += monthly;
    if (month % 12 === 0) {
      rows.push({ year: month / 12, contributions, value });
    }
  }
  return rows;
}

export function WealthView() {
  const me = useMe();
  const tierPrice = me.data?.tier.monthlyPrice ?? 149;

  const [initial, setInitial] = useState(5000);
  const [monthly, setMonthly] = useState(3000);
  const [rate, setRate] = useState(8);
  const [years, setYears] = useState(5);
  const [goal, setGoal] = useState(1000);

  const series = compound(initial, monthly, rate, years);
  const finalRow = series[series.length - 1];
  const interest = finalRow.value - finalRow.contributions;

  // Pocket-money target math (from the blueprint framing)
  const clientsAtTierPrice = Math.ceil(goal / Math.max(tierPrice, 1));
  const clientsAt50 = Math.ceil(goal / 50);
  const clientsAt100 = Math.ceil(goal / 100);

  const chartTooltipStyle = {
    backgroundColor: '#171717',
    border: '1px solid #262626',
    borderRadius: '8px',
    fontSize: '12px',
    color: '#e5e5e5',
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Projected Reserve"
          value={money(finalRow.value)}
          accent="text-emerald-400"
          sub={`after ${years} years at ${rate}% annual return`}
          icon={<PiggyBank className="w-4 h-4" />}
        />
        <StatCard
          label="Total Contributions"
          value={money(finalRow.contributions)}
          sub={`${money(monthly)}/mo swept from SaaS margins`}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <StatCard
          label="Interest Earned"
          value={money(interest)}
          accent="text-cyan-400"
          sub="Compounding layer on top of swept profits"
          icon={<TrendingUp className="w-4 h-4" />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <SectionCard
          title="💵 Wealth Accumulation Model"
          description="Simulate long-term fund accumulation by reinvesting a fixed portion of monthly SaaS profits into a compounding asset class."
          className="xl:col-span-2"
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="contribGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="year"
                  stroke="#737373"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `Y${v}`}
                />
                <YAxis
                  stroke="#737373"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  contentStyle={chartTooltipStyle}
                  formatter={(v: number, name: string) => [money(v), name === 'value' ? 'Portfolio Value' : 'Contributions']}
                />
                <Area type="monotone" dataKey="contributions" stroke="#22d3ee" strokeWidth={1.5} fill="url(#contribGrad)" />
                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} fill="url(#valueGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="🎛️ Model Inputs" description="Tune the capital sweep velocity and horizon.">
            <div className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                    Starting Principal
                  </Label>
                  <span className="text-xs font-mono text-white">{money(initial)}</span>
                </div>
                <Input
                  type="number"
                  min={0}
                  step={500}
                  value={initial}
                  onChange={(e) => setInitial(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="bg-neutral-950 border-neutral-800 text-sm text-white h-8"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                    Monthly Profit Sweep
                  </Label>
                  <span className="text-xs font-mono text-white">{money(monthly)}</span>
                </div>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={monthly}
                  onChange={(e) => setMonthly(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="bg-neutral-950 border-neutral-800 text-sm text-white h-8"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                    Annual Return
                  </Label>
                  <span className="text-xs font-mono text-emerald-400">{rate}%</span>
                </div>
                <Slider value={[rate]} min={1} max={15} step={0.5} onValueChange={(v) => setRate(v[0])} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                    Horizon
                  </Label>
                  <span className="text-xs font-mono text-cyan-400">{years} years</span>
                </div>
                <Slider value={[years]} min={1} max={20} step={1} onValueChange={(v) => setYears(v[0])} />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="🎯 Pocket Money Targets"
            description="Client count needed to hit a stable monthly extraction."
          >
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <Label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                    Target Monthly Income
                  </Label>
                  <span className="text-xs font-mono text-white">{money(goal)}/mo</span>
                </div>
                <Input
                  type="number"
                  min={100}
                  step={100}
                  value={goal}
                  onChange={(e) => setGoal(Math.max(100, parseFloat(e.target.value) || 0))}
                  className="bg-neutral-950 border-neutral-800 text-sm text-white h-8"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-[10px] font-mono text-neutral-500 uppercase">@ $50/mo</p>
                  <p className="text-xl font-bold text-white mt-0.5">{clientsAt50}</p>
                  <p className="text-[9px] font-mono text-neutral-600">clients</p>
                </div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-lg p-3">
                  <p className="text-[10px] font-mono text-neutral-500 uppercase">@ $100/mo</p>
                  <p className="text-xl font-bold text-white mt-0.5">{clientsAt100}</p>
                  <p className="text-[9px] font-mono text-neutral-600">clients</p>
                </div>
                <div className="bg-neutral-950 border border-emerald-900/60 rounded-lg p-3">
                  <p className="text-[10px] font-mono text-emerald-400 uppercase">@ ${tierPrice}/mo</p>
                  <p className="text-xl font-bold text-emerald-400 mt-0.5">{clientsAtTierPrice}</p>
                  <p className="text-[9px] font-mono text-neutral-600">B2B tenants</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-[10px] font-mono text-neutral-600 leading-relaxed">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                Simulated projection for planning purposes only — not financial advice. Returns assume a
                simplified monthly compounding model.
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
