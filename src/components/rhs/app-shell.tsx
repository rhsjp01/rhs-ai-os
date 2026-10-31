'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RhsShell } from './app-shell-inner';

export function RhsApp() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <RhsShell />
    </QueryClientProvider>
  );
}
