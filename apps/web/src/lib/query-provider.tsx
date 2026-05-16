"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: (failureCount, error: unknown) => {
              // Don't retry on 4xx — those are client errors and won't fix themselves
              const status =
                (error as { status?: number; statusCode?: number })?.status ??
                (error as { statusCode?: number })?.statusCode;
              if (typeof status === "number" && status >= 400 && status < 500) {
                return false;
              }
              return failureCount < 3; // current default behavior for 5xx/network errors
            },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
