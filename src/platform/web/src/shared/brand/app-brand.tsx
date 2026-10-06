import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../api/platform-api";

export type AppBrand = { tagline: string; title: string };

const fallbackBrand: AppBrand = {
  tagline: String(import.meta.env.VITE_APP_BRAND_TAGLINE ?? "").trim(),
  title: String(import.meta.env.VITE_APP_BRAND_NAME ?? "").trim()
};
const AppBrandContext = createContext<AppBrand>(fallbackBrand);

export function AppBrandProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryFn: () => apiGet<AppBrand>("/app-branding"),
    queryKey: ["app-branding"],
    retry: false,
    staleTime: 60_000
  });
  return (
    <AppBrandContext.Provider value={query.data ?? fallbackBrand}>
      {children}
    </AppBrandContext.Provider>
  );
}

export function useAppBrand() {
  return useContext(AppBrandContext);
}
