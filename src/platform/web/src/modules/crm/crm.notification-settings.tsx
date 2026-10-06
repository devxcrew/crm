import { BellOff, BellRing } from "lucide-react";
import { Button } from "@codexsun/ui/components/button";
import { Card, CardContent } from "@codexsun/ui/components/card";
import { toast } from "@codexsun/ui/components/sonner";
import { WorkspacePage } from "@codexsun/ui/workspace/page";
import {
  sendCrmTestNotification,
  useBrowserNotificationPermission,
  useCrmCallNotificationPreference
} from "./crm.call-notifications";

export function CrmNotificationSettings() {
  const browserNotifications = useBrowserNotificationPermission();
  const notificationPreference = useCrmCallNotificationPreference();
  const blocked = browserNotifications.permission === "denied";
  const enabled = browserNotifications.permission === "granted" && notificationPreference.enabled;

  async function toggleNotifications() {
    if (browserNotifications.permission === "granted") {
      notificationPreference.setEnabled(!notificationPreference.enabled);
      return;
    }
    const permission = await browserNotifications.requestPermission();
    if (permission === "granted") notificationPreference.setEnabled(true);
  }

  async function resetNotifications() {
    notificationPreference.reset();
    const permission = browserNotifications.refreshPermission();
    if (permission === "default") await toggleNotifications();
  }

  function testNotification() {
    if (sendCrmTestNotification()) {
      toast.success("Test notification sent", {
        description: "Check the Windows notification area if it is not shown immediately."
      });
      return;
    }
    toast.error("Windows alerts are disabled", {
      description: "Enable Windows alerts before sending a test notification."
    });
  }

  return (
    <WorkspacePage
      description="Allow this browser to show Windows alerts for changes to your My Calls."
      technicalName="page.settings.notifications"
      title="Desktop notifications"
    >
      <Card className="max-w-2xl shadow-sm">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Windows notifications</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {enabled
                ? "CRM checks for new calls every few seconds and alerts you about assignments, status changes, and replies from other users."
                : "Windows alerts are disabled for this browser. Turn them on when you want alerts for My Calls."}
            </p>
          </div>
          {browserNotifications.isSupported ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={blocked}
                title={
                  blocked
                    ? "Reset the browser permission, then return here."
                    : enabled
                      ? "Disable desktop notifications for this browser."
                      : "Enable desktop notifications for this browser."
                }
                type="button"
                variant={enabled ? "outline" : "default"}
                onClick={() => void toggleNotifications()}
              >
                {enabled ? <BellOff className="size-4" /> : <BellRing className="size-4" />}
                {enabled ? "Disable Windows alerts" : "Enable Windows alerts"}
              </Button>
              <Button type="button" variant="outline" onClick={() => void resetNotifications()}>
                Reset and refresh
              </Button>
              <Button
                disabled={!enabled}
                title="Send a Windows notification to verify this browser."
                type="button"
                variant="outline"
                onClick={testNotification}
              >
                <BellRing className="size-4" />
                Test notification
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This browser does not support desktop notifications.
            </p>
          )}
        </CardContent>
        {blocked ? (
          <p className="border-t px-5 py-3 text-xs text-muted-foreground">
            To reset a blocked permission in Windows Chrome or Edge, select the site icon beside the
            address bar, open Site settings, set Notifications to Allow, then return to this page and
            select Reset and refresh.
          </p>
        ) : null}
      </Card>
    </WorkspacePage>
  );
}
