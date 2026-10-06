import { apiGet, apiPut } from "../../shared/api/platform-api";
import type { NotificationInboxItem } from "./notification.types";

const path = "/notifications";

export function listNotifications() {
  return apiGet<NotificationInboxItem[]>(path);
}

export function markNotificationRead(id: number) {
  return apiPut<NotificationInboxItem>(`${path}/${id}/read`);
}
