'use client';

import { useState } from 'react';
import { Lock, Mail, Building2, User, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { post, setSessionToken, ApiError } from '@/lib/rhs/api';
import type { AuthResponse } from '@/lib/rhs/types';
import { validateCorporateEmail } from '@/lib/tiers';
import { GradientButton } from './ui-bits';

// ---------------------------------------------------------------------------
// Client-only auth card (mounted via next/dynamic with ssr:false from
// login-gateway). Keeping the credential forms out of the server-rendered
// tree means the crawler HTML contains zero password-form markup, and the
// one-click demo workspace below never ships credentials in the client
// bundle — the session is minted server-side by POST /api/auth/demo.
// ---------------------------------------------------------------------------

export function GatewayAuthCard({ onAuthed }: { onAuthed: () => void }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await post<AuthResponse>('/auth/login', { email, password });
      if (res.token) setSessionToken(res.token);
      onAuthed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Authentication gateway unreachable.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const domainCheck = validateCorporateEmail(email);
    if (!domainCheck.isValid) {
      setError(domainCheck.reason ?? 'Corporate email required.');
      return;
    }
    setBusy(true);
    try {
      const res = await post<AuthResponse>('/auth/register', { companyName, fullName, email, password });
      if (res.token) setSessionToken(res.token);
      toast({
        title: 'Workspace provisioned',
        description: 'Free Discovery tier activated — 5 property audit tokens.',
      });
      onAuthed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration pipeline failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDemoSignIn = async () => {
    setError('');
    setDemoBusy(true);
    try {
      const res = await post<AuthResponse>('/auth/demo', {});
      if (res.token) setSessionToken(res.token);
      onAuthed();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Demo gateway unreachable.');
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <>
      {error ? (
        <p className="text-xs text-red-400 font-mono bg-red-950/30 border border-red-900/50 p-2.5 rounded-lg mb-4 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
        </p>
      ) : null}

      <Tabs value={mode} onValueChange={(v) => { setMode(v as 'signin' | 'register'); setError(''); }}>
        <TabsList className="grid grid-cols-2 w-full bg-neutral-950 border border-neutral-800 mb-5">
          <TabsTrigger value="signin" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-white text-neutral-400 text-xs">
            Sign In
          </TabsTrigger>
          <TabsTrigger value="register" className="data-[state=active]:bg-neutral-800 data-[state=active]:text-white text-neutral-400 text-xs">
            Create Workspace
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Account Email
              </Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ops@yourcompany.com"
                  required
                  className="bg-neutral-950 border-neutral-800 pl-9 text-sm text-white focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="password" className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Security Key Phrase
              </Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="bg-neutral-950 border-neutral-800 pl-9 text-sm text-white focus:border-emerald-500"
                />
              </div>
            </div>
            <GradientButton type="submit" disabled={busy} className="w-full">
              {busy ? 'Verifying Gateway Credentials…' : 'Authenticate & Enter'}
            </GradientButton>
          </form>
        </TabsContent>

        <TabsContent value="register">
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <Label htmlFor="company" className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Company / Organization
              </Label>
              <div className="relative mt-1">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
                <Input
                  id="company"
                  type="text"
                  autoComplete="organization"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Property Group"
                  required
                  className="bg-neutral-950 border-neutral-800 pl-9 text-sm text-white focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="fullname" className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Full Name (optional)
              </Label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
                <Input
                  id="fullname"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Field Manager"
                  className="bg-neutral-950 border-neutral-800 pl-9 text-sm text-white focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="reg-email" className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Corporate Email
              </Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
                <Input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ops@yourcompany.com"
                  required
                  className="bg-neutral-950 border-neutral-800 pl-9 text-sm text-white focus:border-emerald-500"
                />
              </div>
              <p className="text-[10px] text-neutral-600 mt-1 font-mono">
                Consumer domains (gmail, yahoo, outlook…) are restricted — B2B profiles only.
              </p>
            </div>
            <div>
              <Label htmlFor="reg-password" className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">
                Security Key Phrase
              </Label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-600" />
                <Input
                  id="reg-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  required
                  minLength={8}
                  className="bg-neutral-950 border-neutral-800 pl-9 text-sm text-white focus:border-emerald-500"
                />
              </div>
            </div>
            <GradientButton type="submit" disabled={busy} className="w-full">
              {busy ? 'Provisioning Workspace…' : 'Create Free Workspace'}
            </GradientButton>
            <p className="text-[10px] text-neutral-600 font-mono text-center">
              Free Discovery tier: 5 property audits · 1 AEO keyword · view-only compliance ledger
            </p>
          </form>
        </TabsContent>
      </Tabs>

      {/* One-click demo workspace — the session is minted server-side by
          POST /api/auth/demo; no credentials exist in the client bundle. */}
      <div className="mt-5 pt-5 border-t border-neutral-800/60 space-y-2">
        <p className="text-[10px] font-mono text-neutral-600 uppercase tracking-wider text-center">
          Guided evaluation
        </p>
        <button
          type="button"
          onClick={handleDemoSignIn}
          disabled={demoBusy || busy}
          className="w-full flex items-center justify-between gap-3 bg-neutral-950/60 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg px-3.5 py-2.5 text-left transition-colors disabled:opacity-60"
        >
          <div className="min-w-0">
            <p className="text-xs font-mono text-neutral-300 truncate">Carolina Infrastructure Partners</p>
            <p className="text-[10px] text-neutral-600">Seeded demo workspace — Pro-tier data, safe to explore</p>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 border border-cyan-900 bg-cyan-950/50 rounded px-1.5 py-0.5 shrink-0">
            {demoBusy ? 'ENTERING…' : 'ENTER DEMO'}
          </span>
        </button>
      </div>
    </>
  );
}
