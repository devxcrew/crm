import { useQuery } from "@tanstack/react-query";
import { listNotifications } from "./notification.services";

export const notificationInboxQueryKey = ["notifications", "inbox"] as const;

export function useNotificationInboxQuery(enabled = true) {
  return useQuery({
    enabled,
    queryFn: listNotifications,
    queryKey: notificationInboxQueryKey,
    refetchInterval: 2_000,
    refetchIntervalInBackground: true
  });
}
