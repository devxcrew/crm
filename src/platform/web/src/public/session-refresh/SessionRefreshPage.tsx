import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GlobalLoader } from "@codexsun/ui/components/global-loader";
import { resetBrowserSession } from "../../shared/api/platform-api";

export function SessionRefreshPage() {
  const queryClient = useQueryClient();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void refresh();

    async function refresh() {
      try {
        await queryClient.cancelQueries();
        queryClient.clear();
        await resetBrowserSession();
      } finally {
        queryClient.clear();
        window.location.replace("/login?reason=session-refreshed");
      }
    }
  }, [queryClient]);

  return <GlobalLoader />;
}
