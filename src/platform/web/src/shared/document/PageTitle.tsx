import { useEffect } from "react";

import { useAppBrand } from "../brand/app-brand";

export function setPlatformDocumentTitle(brandTitle: string, pageTitle: string) {
  document.title = `${brandTitle} | ${pageTitle}`;
}

const pageTitles: Record<string, string> = {
  "/": "Login",
  "/admin": "Admin Desk",
  "/admin/login": "Staff Admin Login",
  "/app": "Application Desk",
  "/login": "App Login",
  "/sa": "Super Admin Desk",
  "/sa/login": "Super Admin Login",
  "/status": "Status",
  "/workspace": "Dashboard"
};

function resolvePageTitle(pathname: string) {
  if (pathname.startsWith("/sa/") && pathname !== "/sa/login") {
    return "Super Admin Desk";
  }
  if (pathname.startsWith("/app/")) {
    return "Application Desk";
  }
  return pageTitles[pathname] ?? "Dashboard";
}

export function PageTitle() {
  const brand = useAppBrand();
  useEffect(() => {
    const updateTitle = () => {
      if (window.location.pathname.startsWith("/app/")) return;
      setPlatformDocumentTitle(brand.title, resolvePageTitle(window.location.pathname));
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushState(...args) {
      originalPushState.apply(this, args);
      updateTitle();
    };

    window.history.replaceState = function replaceState(...args) {
      originalReplaceState.apply(this, args);
      updateTitle();
    };

    window.addEventListener("popstate", updateTitle);
    updateTitle();

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", updateTitle);
    };
  }, [brand.title]);

  return null;
}
