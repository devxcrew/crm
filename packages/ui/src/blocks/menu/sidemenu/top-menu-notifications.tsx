"use client";

import { useState } from "react";
import { BellIcon, XIcon } from "lucide-react";
import { Button } from "../../../components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "../../../components/dropdown-menu";
import type { TopUserMenuUser } from "./top-user-menu";

export type TopMenuNotification = {
  body: string;
  id: string;
  title: string;
};

export function TopMenuNotifications({
  notifications,
  onDismiss,
  user,
  workspaceTitle
}: {
  notifications: TopMenuNotification[];
  onDismiss?: (id: string) => void;
  user: TopUserMenuUser;
  workspaceTitle: string;
}) {
  const [showWelcome, setShowWelcome] = useState(true);
  const unreadCount = notifications.length + Number(showWelcome);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
          className="relative size-9 rounded-full"
          size="icon"
          variant="ghost"
        >
          <BellIcon />
          {unreadCount ? (
            <span className="absolute right-1.5 top-1.5 flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/70" />
              <span className="relative inline-flex size-2.5 rounded-full border-2 border-background bg-destructive" />
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[30rem] w-80 overflow-y-auto rounded-2xl border bg-popover p-2 text-popover-foreground shadow-xl"
        sideOffset={10}
      >
        <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold">Notifications</DropdownMenuLabel>
        <div className="space-y-2">
          {showWelcome ? (
            <NotificationCard
              body={`Hi ${user.name}, your workspace is ready. You can start managing your enquiries.`}
              onDismiss={() => setShowWelcome(false)}
              title={`Welcome to ${workspaceTitle}`}
            />
          ) : null}
          {notifications.map((notification) => (
            <NotificationCard
              body={notification.body}
              key={notification.id}
              {...(onDismiss ? { onDismiss: () => onDismiss(notification.id) } : {})}
              title={notification.title}
            />
          ))}
          {!showWelcome && notifications.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              You have no new notifications.
            </p>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationCard({
  body,
  onDismiss,
  title
}: {
  body: string;
  onDismiss?: () => void;
  title: string;
}) {
  return (
    <div className="relative rounded-xl border bg-background px-3 py-3 pr-10 shadow-sm">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
      {onDismiss ? (
        <Button
          aria-label={`Dismiss ${title} notification`}
          className="absolute right-2 top-2 size-7 rounded-full"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDismiss();
          }}
          size="icon"
          type="button"
          variant="ghost"
        >
          <XIcon className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
