import { useCallback, useEffect, useState } from "react";

type NotificationPermissionState = NotificationPermission | "unsupported";

type CallNotification = {
  body: string;
  id: string;
  title: string;
};

export type CrmInAppNotification = CallNotification;

export const crmInAppNotificationEvent = "techmedia:crm-in-app-notification";
const notificationPermissionEvent = "techmedia:browser-notification-permission";
const notificationPreferenceEvent = "techmedia:crm-call-notifications";
const notificationPreferenceStorageKey = "techmedia.crm.calls.notifications.enabled";

export function useBrowserNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermissionState>(notificationPermission);

  const refreshPermission = useCallback(() => {
    const nextPermission = notificationPermission();
    setPermission(nextPermission);
    return nextPermission;
  }, []);

  useEffect(() => {
    const sync = () => refreshPermission();
    window.addEventListener(notificationPermissionEvent, sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(notificationPermissionEvent, sync);
      window.removeEventListener("focus", sync);
    };
  }, [refreshPermission]);

  const requestPermission = useCallback(async () => {
    if (!supportsNotifications()) return "unsupported" as const;
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    window.dispatchEvent(new Event(notificationPermissionEvent));
    return nextPermission;
  }, []);
  return { isSupported: permission !== "unsupported", permission, refreshPermission, requestPermission };
}

export function useCrmCallNotificationPreference() {
  const [enabled, setEnabledState] = useState(readNotificationPreference);

  useEffect(() => {
    const sync = () => setEnabledState(readNotificationPreference());
    window.addEventListener(notificationPreferenceEvent, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(notificationPreferenceEvent, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setEnabled = useCallback((nextEnabled: boolean) => {
    try {
      localStorage.setItem(notificationPreferenceStorageKey, String(nextEnabled));
    } catch {}
    setEnabledState(nextEnabled);
    window.dispatchEvent(new Event(notificationPreferenceEvent));
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(notificationPreferenceStorageKey);
    } catch {}
    setEnabledState(true);
    window.dispatchEvent(new Event(notificationPreferenceEvent));
  }, []);

  return { enabled, reset, setEnabled };
}

export function sendCrmTestNotification() {
  if (!supportsNotifications() || Notification.permission !== "granted") return false;
  const notification = {
    body: "Windows alerts are working for your My Calls.",
    id: `test-${Date.now()}`,
    title: "CRM notification test"
  };
  publishInAppNotification(notification);
  showNotification(notification);
  return true;
}

export function showCrmDesktopNotification(value: CrmInAppNotification) {
  if (!supportsNotifications() || Notification.permission !== "granted") return;
  showNotification(value);
}

function showNotification(value: CallNotification) {
  const browserNotification = new Notification(value.title, {
    body: value.body,
    tag: `techmedia-crm-${value.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  });
  browserNotification.onclick = () => window.focus();
}

function publishInAppNotification(value: CrmInAppNotification) {
  window.dispatchEvent(
    new CustomEvent<CrmInAppNotification>(crmInAppNotificationEvent, { detail: value })
  );
}

function notificationPermission(): NotificationPermissionState {
  return supportsNotifications() ? Notification.permission : "unsupported";
}

function readNotificationPreference() {
  try {
    return localStorage.getItem(notificationPreferenceStorageKey) !== "false";
  } catch {
    return true;
  }
}

function supportsNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}
