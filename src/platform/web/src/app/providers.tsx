import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppBrandProvider } from "../shared/brand/app-brand";

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppBrandProvider>{children}</AppBrandProvider>
    </QueryClientProvider>
  );
}
