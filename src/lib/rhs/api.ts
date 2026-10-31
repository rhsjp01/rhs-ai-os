'use client';

import { useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { MeResponse } from './types';

// ---------------------------------------------------------------------------
// Bearer token store — fallback for contexts where the httpOnly session cookie
// is unavailable (embedded cross-site preview iframes that block third-party
// cookies). First-party clients simply keep using the cookie in parallel.
// ---------------------------------------------------------------------------
const TOKEN_STORAGE_KEY = 'rhs_bearer_token';
const TOKEN_EVENT = 'rhs-token-change';

let bearerToken: string | null = null;

function loadStoredToken(): void {
  try {
    const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (typeof stored === 'string' && stored.length > 0) bearerToken = stored;
  } catch {
    // localStorage unavailable (private mode etc.) — cookie flow still applies
  }
}

function emitTokenChange(): void {
  window.dispatchEvent(new Event(TOKEN_EVENT));
}

if (typeof window !== 'undefined') loadStoredToken();

export function setSessionToken(token: string): void {
  bearerToken = token;
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    /* non-fatal */
  }
  if (typeof window !== 'undefined') emitTokenChange();
}

export function clearSessionToken(): void {
  bearerToken = null;
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* non-fatal */
  }
  if (typeof window !== 'undefined') emitTokenChange();
}

function subscribeToken(callback: () => void): () => void {
  window.addEventListener(TOKEN_EVENT, callback);
  // 'storage' fires when another tab mutates the token
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(TOKEN_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/**
 * Whether a client-side session token exists. Server snapshot is always
 * `false`, so SSR and the initial hydration render render the logged-out
 * gateway (meaningful content for crawlers / answer engines); a returning
 * user re-renders into the boot screen while the session is restored.
 */
export function useHasSessionToken(): boolean {
  return useSyncExternalStore(
    subscribeToken,
    () => bearerToken !== null,
    () => false,
  );
}

export class ApiError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  const res = await fetch(`/api${path}`, { ...init, headers });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  if (!res.ok) {
    // 401 ⇒ the active session (cookie or bearer) is no longer valid.
    if (res.status === 401 && bearerToken) clearSessionToken();
    throw new ApiError(
      typeof data.error === 'string' ? data.error : 'Request failed.',
      res.status,
      typeof data.code === 'string' ? data.code : undefined,
    );
  }
  return data as T;
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return api<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) });
}

export function del<T>(path: string): Promise<T> {
  return api<T>(path, { method: 'DELETE' });
}

// Shared session query — every component dedupes onto the same cache entry.
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/auth/me'),
    retry: false,
    staleTime: 15_000,
  });
}
