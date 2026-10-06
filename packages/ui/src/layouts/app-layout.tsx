import type { CSSProperties, ReactNode } from "react";
import {
  AppWindowIcon,
  BadgeCheckIcon,
  BriefcaseBusinessIcon,
  Globe2Icon,
  LogOutIcon,
  MailIcon,
  MonitorCogIcon,
  PanelsTopLeftIcon,
  RefreshCwIcon,
  SparklesIcon,
  UsersRoundIcon,
  WalletCardsIcon
} from "lucide-react";

import {
  AppSidebar,
  type SidebarBrand,
  type SidebarUser,
  type SidebarUserMenuItem
} from "../blocks/menu/sidemenu/app-sidebar";
import { TopMenu, type TopMenuWorkspaceItem } from "../blocks/menu/sidemenu/top-menu";
import type { TopMenuNotification } from "../blocks/menu/sidemenu/top-menu-notifications";
import type { SidemenuItem } from "../blocks/menu/sidemenu/sub/sidemenu-section";
import { SidebarInset, SidebarProvider } from "../components/sidebar";

type AppLayoutProps = {
  addUserHref?: string;
  brand?: SidebarBrand;
  bottomMenuItems?: SidemenuItem[];
  children: ReactNode;
  globalSearchPlaceholder?: string;
  globalSearchValue?: string;
  headerTitle?: ReactNode;
  homeHref?: string;
  logoutHref?: string;
  menuItems?: SidemenuItem[];
  onGlobalSearchValueChange?: (value: string) => void;
  onLogout?: () => void | Promise<void>;
  notifications?: TopMenuNotification[];
  onNotificationDismiss?: (id: string) => void;
  profileHref?: string;
  showHomeAction?: boolean;
  subtitle?: ReactNode;
  showSidebarUser?: boolean;
  title?: ReactNode;
  user?: SidebarUser;
  userMenuItems?: SidebarUserMenuItem[];
  versionLabel?: string;
  workspaceItems?: TopMenuWorkspaceItem[];
  showPageTitle?: boolean;
};

export const defaultWorkspaceItems: TopMenuWorkspaceItem[] = [
  {
    title: "Application",
    description: "Shared workspace, company setup, and modules.",
    icon: BriefcaseBusinessIcon,
    url: "/workspace"
  },
  {
    title: "ZETRO",
    description: "Business assistance chat for teams.",
    icon: SparklesIcon,
    url: "/app"
  },
  {
    title: "Operations",
    description: "Operations and shared modules.",
    icon: AppWindowIcon,
    active: true,
    url: "/workspace"
  },
  {
    title: "Mail",
    description: "Reusable workspace mail services.",
    icon: MailIcon,
    url: "/app"
  },
  {
    title: "Tools",
    description: "Tools and app extensions.",
    icon: Globe2Icon,
    url: "/app"
  }
];

export const defaultAppMenuItems: SidemenuItem[] = [
  {
    title: "Admin",
    url: "/workspace",
    icon: WalletCardsIcon,
    isActive: true,
    items: [
      {
        title: "Master Modules",
        url: "/workspace"
      },
      {
        title: "Platform Masters",
        url: "/admin"
      },
      {
        title: "Security Surface",
        url: "/app"
      }
    ]
  },
  {
    title: "Application",
    url: "/app",
    icon: UsersRoundIcon
  },
  {
    title: "Settings",
    url: "/app",
    icon: MonitorCogIcon
  },
  {
    title: "Apps",
    url: "/workspace",
    icon: AppWindowIcon
  },
  {
    title: "Compliance",
    url: "/status",
    icon: RefreshCwIcon
  }
];

export const defaultSidebarBrand: SidebarBrand = {
  href: "/workspace",
  subtitle: "super-admin",
  title: "Super Admin Desk"
};

export const defaultSidebarUser: SidebarUser = {
  email: "user@codexsun.app",
  fallback: "U",
  name: "User"
};

export const defaultUserMenuItems: SidebarUserMenuItem[] = [
  {
    icon: SparklesIcon,
    title: "Upgrade to Pro"
  },
  {
    icon: BadgeCheckIcon,
    title: "Account"
  },
  {
    icon: AppWindowIcon,
    title: "Workspace"
  },
  {
    icon: MonitorCogIcon,
    title: "Notifications"
  },
  {
    icon: PanelsTopLeftIcon,
    title: "Super Admin login",
    url: "/sa"
  },
  {
    icon: LogOutIcon,
    title: "Log out",
    url: "/login"
  }
];

export function AppLayout({
  addUserHref,
  brand = defaultSidebarBrand,
  bottomMenuItems,
  children,
  globalSearchPlaceholder,
  globalSearchValue,
  headerTitle = "Documents",
  homeHref = "/workspace",
  logoutHref = "/login",
  menuItems = defaultAppMenuItems,
  onGlobalSearchValueChange,
  onLogout,
  notifications,
  onNotificationDismiss,
  profileHref,
  showHomeAction = true,
  showSidebarUser = true,
  subtitle,
  title,
  user = defaultSidebarUser,
  userMenuItems = defaultUserMenuItems,
  versionLabel = "v 1.0.1",
  workspaceItems = defaultWorkspaceItems,
  showPageTitle = true
}: AppLayoutProps) {
  return (
    <SidebarProvider
      className="flex-col"
      style={
        {
          "--sidebar-width": "19rem"
        } as CSSProperties
      }
    >
      <TopMenu
        {...(addUserHref ? { addUserHref } : {})}
        {...(globalSearchPlaceholder ? { globalSearchPlaceholder } : {})}
        {...(globalSearchValue !== undefined ? { globalSearchValue } : {})}
        homeHref={homeHref}
        logoutHref={logoutHref}
        {...(onGlobalSearchValueChange ? { onGlobalSearchValueChange } : {})}
        {...(onLogout ? { onLogout } : {})}
        {...(notifications ? { notifications } : {})}
        {...(onNotificationDismiss ? { onNotificationDismiss } : {})}
        pageTitle={String(headerTitle)}
        {...(profileHref ? { profileHref } : {})}
        showHomeAction={showHomeAction}
        showPageTitle={showPageTitle}
        user={user}
        workspaceItems={workspaceItems}
      />
      <div className="flex min-h-0 flex-1">
        <AppSidebar
          brand={brand}
          {...(bottomMenuItems ? { bottomItems: bottomMenuItems } : {})}
          className="md:!bottom-auto md:!top-14 md:!h-[calc(100svh-3.5rem)] md:!p-1"
          items={menuItems}
          showUserMenu={showSidebarUser}
          user={user}
          userMenuItems={userMenuItems}
          variant="inset"
          versionLabel={versionLabel}
        />
        <SidebarInset className="md:!m-1 md:!ml-0">
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              {title || subtitle ? (
                <div className="border-b bg-background px-4 py-5 lg:px-6">
                  {title ? (
                    <h2 className="m-0 text-2xl font-semibold leading-tight">{title}</h2>
                  ) : null}
                  {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
                </div>
              ) : null}
              {children}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
