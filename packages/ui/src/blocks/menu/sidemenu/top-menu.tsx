"use client";

import {
  BriefcaseBusinessIcon,
  CheckIcon,
  GripIcon,
  HomeIcon,
  type LucideIcon,
  MailIcon,
  SearchIcon,
  SparklesIcon,
  WrenchIcon
} from "lucide-react";

import { Button } from "../../../components/button";
import { Avatar, AvatarFallback, AvatarImage } from "../../../components/avatar";
import { Input } from "../../../components/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger
} from "../../../components/dropdown-menu";
import { Separator } from "../../../components/separator";
import { SidebarTrigger } from "../../../components/sidebar";
import { TopUserMenu, type TopUserMenuUser } from "./top-user-menu";
import { TopMenuNotifications, type TopMenuNotification } from "./top-menu-notifications";

export type TopMenuWorkspaceItem = {
  active?: boolean;
  avatar?: boolean;
  description: string;
  icon: LucideIcon;
  onSelect?: () => void;
  title: string;
  url?: string;
};

export type TopMenuProps = {
  addUserHref?: string;
  globalSearchPlaceholder?: string;
  globalSearchValue?: string;
  homeHref?: string;
  logoutHref?: string;
  onGlobalSearchValueChange?: (value: string) => void;
  onLogout?: () => void | Promise<void>;
  notifications?: TopMenuNotification[];
  onNotificationDismiss?: (id: string) => void;
  pageTitle?: string;
  profileHref?: string;
  showHomeAction?: boolean;
  user: TopUserMenuUser;
  workspaceItems?: TopMenuWorkspaceItem[];
  showPageTitle?: boolean;
};

const defaultWorkspaceItems: TopMenuWorkspaceItem[] = [
  {
    title: "Application",
    description: "Shared workspace, company setup, and modules.",
    icon: BriefcaseBusinessIcon
  },
  {
    title: "ZETRO",
    description: "Business assistance chat for teams.",
    icon: SparklesIcon
  },
  {
    title: "Operations",
    description: "Operations and shared modules.",
    icon: WrenchIcon,
    active: true
  },
  {
    title: "Mail",
    description: "Reusable workspace mail services.",
    icon: MailIcon
  },
  {
    title: "Tools",
    description: "Tools and app extensions.",
    icon: WrenchIcon
  }
];

export function TopMenu({
  addUserHref,
  globalSearchPlaceholder = "Search",
  globalSearchValue = "",
  homeHref = "/workspace",
  logoutHref = "/login",
  onGlobalSearchValueChange,
  onLogout,
  notifications = [],
  onNotificationDismiss,
  pageTitle = "Workspace",
  profileHref,
  showHomeAction = true,
  user,
  workspaceItems = defaultWorkspaceItems,
  showPageTitle = true
}: TopMenuProps) {
  const activeWorkspace = workspaceItems.find((item) => item.active) ?? workspaceItems[0];
  const ActiveWorkspaceIcon = activeWorkspace?.icon ?? BriefcaseBusinessIcon;

  return (
    <header className="app-top-menu sticky top-0 z-30 flex h-14 w-full shrink-0 items-center border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90">
      <div className="app-top-menu-context flex h-full shrink-0 items-center">
        <div className="flex h-full w-16 items-center justify-center border-r bg-background">
          <SidebarTrigger className="size-9 rounded-full border-0 bg-transparent shadow-none" />
        </div>
        <div className="flex min-w-0 items-center gap-3 px-4 text-sm">
          <div className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium">
            <ActiveWorkspaceIcon className="size-4 text-muted-foreground" />
            <span>{activeWorkspace?.title ?? "Workspace"}</span>
          </div>
          {showPageTitle ? (
            <>
              <Separator className="h-4" orientation="vertical" />
              <span className="truncate font-medium">{pageTitle}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="app-top-menu-search mx-3 flex min-w-24 max-w-3xl flex-1 items-center sm:mx-6">
        <div className="relative w-full">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Global search"
            className="h-10 rounded-full border-transparent bg-muted/80 pl-11 pr-4 shadow-none focus-visible:border-primary/30 focus-visible:bg-background"
            onChange={(event) => onGlobalSearchValueChange?.(event.target.value)}
            placeholder={globalSearchPlaceholder}
            type="search"
            value={globalSearchValue}
          />
        </div>
      </div>
      <div className="app-top-menu-actions ml-auto flex shrink-0 items-center gap-1 px-3">
        <TopMenuNotifications
          notifications={notifications}
          {...(onNotificationDismiss ? { onDismiss: onNotificationDismiss } : {})}
          user={user}
          workspaceTitle={activeWorkspace?.title ?? "workspace"}
        />
        {showHomeAction ? (
          <Button asChild className="hidden h-8 px-3 sm:inline-flex" size="sm" variant="outline">
            <a href={homeHref}>
              <HomeIcon />
              Home
            </a>
          </Button>
        ) : null}
        <div className="ml-3 flex items-center gap-3">
          <AppLauncher items={workspaceItems} user={user} />
          <TopUserMenu
            {...(addUserHref ? { addUserHref } : {})}
            logoutHref={logoutHref}
            {...(onLogout ? { onLogout } : {})}
            {...(profileHref ? { profileHref } : {})}
            user={user}
          />
        </div>
      </div>
    </header>
  );
}

function AppLauncher({ items, user }: { items: TopMenuWorkspaceItem[]; user: TopUserMenuUser }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Apps"
          className="size-9 rounded-full p-0 ring-2 ring-primary/20 ring-offset-1 ring-offset-background"
          size="icon"
          variant="ghost"
        >
          <GripIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[22rem] rounded-[1.75rem] border bg-popover p-3 text-popover-foreground shadow-2xl"
        sideOffset={10}
      >
        <DropdownMenuLabel className="px-3 py-2 text-sm font-medium">Apps</DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-background p-2 shadow-sm">
          {items.map((item) => (
            <DropdownMenuItem
              asChild={Boolean(item.url && !item.onSelect)}
              className="relative flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl p-2 text-center"
              key={item.title}
              {...(item.onSelect
                ? {
                    onSelect: (event) => {
                      event.preventDefault();
                      item.onSelect?.();
                    }
                  }
                : {})}
            >
              {item.url && !item.onSelect ? (
                <a href={item.url} title={item.description}>
                  <AppLauncherTile item={item} user={user} />
                </a>
              ) : (
                <button title={item.description} type="button">
                  <AppLauncherTile item={item} user={user} />
                </button>
              )}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppLauncherTile({ item, user }: { item: TopMenuWorkspaceItem; user: TopUserMenuUser }) {
  return (
    <>
      <div
        className={`relative flex size-11 items-center justify-center rounded-xl border bg-background shadow-sm ${
          item.active ? "border-primary/40 bg-primary/10 text-primary ring-2 ring-primary/10" : ""
        }`}
      >
        {item.avatar ? (
          <Avatar className="size-9">
            {user.avatarSrc ? <AvatarImage alt={user.name} src={user.avatarSrc} /> : null}
            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
              {user.fallback}
            </AvatarFallback>
          </Avatar>
        ) : (
          <item.icon className="size-5" />
        )}
        {item.active ? (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckIcon className="size-2.5" />
          </span>
        ) : null}
      </div>
      <span className="w-full truncate text-xs font-medium">{item.title}</span>
    </>
  );
}
